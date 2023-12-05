# Physics Game of sort

1 cube and 1 sphere spawn in 4 places in an unpredictable way, they get destroyed if they fall off the platform.
The player is equipped with a stick to hit them off the platform, the game is lost lost if so many objects spawn 
that it clogs the browser.

- The floor texture is a fragment shader, the rest of the objects just use MeshPhongMaterial. 
- The stick is a hinge joint provided by Ammo, the static end is hidden but moves with the player.
- The game counts spawned, destroyed and current objects.
- It uses the default FPS camera (which isn't ideal tbf).
