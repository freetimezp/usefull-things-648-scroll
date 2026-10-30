export const vertexShader = `
    varying vec2 vUv;
    varying vec2 vScreen;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vScreen = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
    }
`;

export const fragmentShader = `
    #define SAMPLE_COUNT 32
    #define GOLDEN_ANGLE 2.39996323

    uniform sampler2D uTexture;

    uniform vec2 uTextureSize;
    uniform vec2 uCoverScale;
    uniform vec2 uImageSize;

    uniform float uBlurRadius;
    uniform float uBlurZone;
    uniform float uAberration;
    uniform float uClampEdges;

    varying vec2 vUv;
    varying vec2 vScreen;

    vec2 coverUv(vec2 pixel) {
        vec2 insidePixel = clamp(
            pixel,
            vec2(0.5),
            uImageSize - 0.5
        );

        return (insidePixel / uImageSize - 0.5) * uCoverScale + 0.5;
    }

    float edgeMask(vec2 pixel, float softness) {
        vec2 edgeDistance = min(pixel, uImageSize - pixel);
        vec2 mask = smoothstep(-softness, softness, edgeDistance);

        return mask.x * mask.y;
    }

    vec3 splitColor(vec2 pixel, vec2 shift, float lod) {
        return vec3(
            textureLod(uTexture, coverUv(pixel + shift), lod).r,
            textureLod(uTexture, coverUv(pixel), lod).g,
            textureLod(uTexture, coverUv(pixel - shift), lod).b

        );
    }

    vec3 blurredColor(vec2 pixel, float radius, vec2 shift) {
        float sampleSpacing = radius / sqrt(float(SAMPLE_COUNT)) * 2.0;

        vec2 texelsPerPixel = uCoverScale * uTextureSize / uImageSize;

        float lod = log2(max(sampleSpacing * max(texelsPerPixel.x, texelsPerPixel.y), 1.0));

        vec3 color = vec3(0.0);
        float totalWeight = 0.0;

        for(int i = 0; i < SAMPLE_COUNT; i++) {
            float progress = (float(i) + 0.5) / float(SAMPLE_COUNT);
            float angle = float(i) * GOLDEN_ANGLE;

            vec2 samplePixel = pixel + vec2(cos(angle), sin(angle)) * sqrt(progress) * radius;

            float weight = exp(-2.0 * progress);

            color += splitColor(samplePixel, shift, lod) * weight;
            totalWeight += weight;
        }

        return color / totalWeight;
    }

    void main() {
        float padding = uBlurRadius * (1.0 - uClampEdges);
        vec2 pixel = vUv * (uImageSize + 2.0 * padding) - padding;

        float edgeDistance = min(vScreen.y, 1.0 - vScreen.y);
        float effectStrength = 1.0 - smoothstep(0.0, uBlurZone, edgeDistance);
        effectStrength *= effectStrength;

        float blurRadius = uBlurRadius * effectStrength;
        vec2 aberrationShift = normalize(vScreen - 0.5 + 0.0001) * uAberration * effectStrength;

        vec3 sharp = splitColor(pixel, aberrationShift, 0.0);
        float sharpAlpha = edgeMask(pixel, 0.5);

        vec3 color;
        float alpha;

        if (blurRadius > 0.1) {
            vec3 blurred = blurredColor(pixel, blurRadius, aberrationShift);
            float t = smoothstep(0.0, 2.0, blurRadius);

            color = mix(sharp, blurred, t);
            alpha = mix(sharpAlpha, edgeMask(pixel, mix(blurRadius * 0.6, 0.5, uClampEdges)), t);
        } else {
            color = sharp;
            alpha = sharpAlpha;    
        }

        gl_FragColor = vec4(color, alpha);

        #include <colorspace_fragment>
    }

`;
