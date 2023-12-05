precision highp float;
uniform vec2 u_resolution;

varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
        // Define the grid size
    // Define the grid size
    float gridSize = 50.;

    // Transform the fragment's position from camera space to world space

    // Calculate the grid pattern based on the world coordinates
    float gridPattern = mod(floor(vUv.x * gridSize) + floor(vUv.y * gridSize), 2.0);

    // Set the color based on the grid pattern
    vec3 color1 = vec3(0.15, 0.03, 0.15);
    vec3 color2 = vec3(0.82, 0.76, 0.83);

    vec3 color = mix(color1, color2, gridPattern);

    gl_FragColor = vec4(color, 1.0);
}