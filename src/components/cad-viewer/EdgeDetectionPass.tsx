import { forwardRef, useMemo } from 'react';
import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const fragmentShader = `
uniform float edgeStrength;
uniform float depthThreshold;
uniform float normalThreshold;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texelSize = 1.0 / vec2(textureSize(inputBuffer, 0));
  
  // Sample depth buffer at current pixel and 4 neighbors (Sobel kernel)
  float depth = getDepth(uv);
  float depthN = getDepth(uv + vec2(0.0, texelSize.y));
  float depthS = getDepth(uv - vec2(0.0, texelSize.y));
  float depthE = getDepth(uv + vec2(texelSize.x, 0.0));
  float depthW = getDepth(uv - vec2(texelSize.x, 0.0));
  
  // Calculate depth gradient (detects silhouettes)
  float depthEdge = abs(depthN - depthS) + abs(depthE - depthW);
  
  // Sample normals at current pixel and neighbors
  vec3 normal = texture2D(normalBuffer, uv).rgb * 2.0 - 1.0;
  vec3 normalN = texture2D(normalBuffer, uv + vec2(0.0, texelSize.y)).rgb * 2.0 - 1.0;
  vec3 normalE = texture2D(normalBuffer, uv + vec2(texelSize.x, 0.0)).rgb * 2.0 - 1.0;
  
  // Calculate normal gradient (detects sharp features)
  float normalEdge = length(normal - normalN) + length(normal - normalE);
  
  // Combine both edge signals with thresholds
  float edge = 0.0;
  edge += step(depthThreshold, depthEdge);
  edge += step(normalThreshold, normalEdge);
  edge = clamp(edge, 0.0, 1.0);
  
  // Mix input color with black edges
  outputColor = mix(inputColor, vec4(0.0, 0.0, 0.0, 1.0), edge * edgeStrength);
}
`;

class EdgeDetectionEffect extends Effect {
  constructor({
    edgeStrength = 1.0,
    depthThreshold = 0.0015,
    normalThreshold = 0.4,
  }: {
    edgeStrength?: number;
    depthThreshold?: number;
    normalThreshold?: number;
  }) {
    super('EdgeDetectionEffect', fragmentShader, {
      uniforms: new Map([
        ['edgeStrength', new Uniform(edgeStrength)],
        ['depthThreshold', new Uniform(depthThreshold)],
        ['normalThreshold', new Uniform(normalThreshold)],
      ]),
    });
  }

  update(renderer: any, inputBuffer: any, deltaTime: number) {
    // Effect will use scene's depth and normal buffers automatically
  }
}

interface EdgeDetectionPassProps {
  edgeStrength?: number;
  depthThreshold?: number;
  normalThreshold?: number;
}

export const EdgeDetectionPass = forwardRef<Effect, EdgeDetectionPassProps>(
  ({ edgeStrength = 1.0, depthThreshold = 0.0015, normalThreshold = 0.4 }, ref) => {
    const effect = useMemo(
      () => new EdgeDetectionEffect({ edgeStrength, depthThreshold, normalThreshold }),
      [edgeStrength, depthThreshold, normalThreshold]
    );

    return <primitive ref={ref} object={effect} dispose={null} />;
  }
);

EdgeDetectionPass.displayName = 'EdgeDetectionPass';
