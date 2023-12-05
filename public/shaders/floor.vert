varying vec2 vUv;
varying vec3 vWorldPosition;

uniform vec2 u_resolution;

void main() {
    vUv = uv;
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    vWorldPosition = gl_Position.xyz;
}