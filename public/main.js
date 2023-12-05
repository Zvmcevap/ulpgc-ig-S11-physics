import * as THREE from "three";
import { FirstPersonControls } from "three/examples/jsm/controls/FirstPersonControls";
import { GUI } from "three/examples/jsm/libs/dat.gui.module";



// Shaders
const floorUniforms = {
    u_resolution: {
        type: "v2",
        value: new THREE.Vector2(),
        },
    u_time: {
      type: "f",
      value: 1.0,
    },
  };

function onWindowResize(e) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    floorUniforms.u_resolution.value.x = renderer.domElement.width;
    floorUniforms.u_resolution.value.y = renderer.domElement.height;
}

let floorVert = await fetch("./shaders/floor.vert");
let floorFrag = await fetch("./shaders/floor.frag");
floorVert = await floorVert.text();
floorFrag = await floorFrag.text();
  

Ammo().then(init);

let physicsWorld, scene, camera, renderer, clock, controls;
let rigidBodies = [], tmpTrans;
let colGroupPlane = 1, colGroupA = 2, colGroupB = 4;



// Vars to play around with:
let gravity, hemiLight, dirLight, broom;
let t0 = 0;


// Create a GUI object with the specified position
const gui = new GUI();



const guiParams = {
    objects_in_scene: rigidBodies.length,
    objects_spawned: 0,
    objects_destroyed: 0,
};
gui.add(guiParams, 'objects_in_scene').name('Number of Objects').listen();
gui.add(guiParams, 'objects_spawned').name('Objects spawned').listen();
gui.add(guiParams, 'objects_destroyed').name('Objects destroyed').listen();


function init (){    
    setupPhysicsWorld();    
    setupGraphics();
    tmpTrans = new Ammo.btTransform();
    createFloor();
    createJointObjects();
    animationLoop();
}

function setupPhysicsWorld(){
    let collisionConfiguration  = new Ammo.btDefaultCollisionConfiguration(),
        dispatcher              = new Ammo.btCollisionDispatcher(collisionConfiguration),
        overlappingPairCache    = new Ammo.btDbvtBroadphase(),
        solver                  = new Ammo.btSequentialImpulseConstraintSolver();

    physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
    gravity = new Ammo.btVector3(0, -10, 0)
    physicsWorld.setGravity(gravity);

}

function setupGraphics(){

    //create clock for timing
    clock = new THREE.Clock();

    //create the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xbfd1e5 );

    //Setup the renderer
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( 0xbfd1e5 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    renderer.shadowMap.enabled = true;
    

    //create camera
    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 5000 );
    camera.position.set( 0, 5, 70 );
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Create controls
    controls = new FirstPersonControls(camera, renderer.domElement)
    controls.movementSpeed = 20;
    controls.lookSpeed = 0.3;

    //Add hemisphere light
    hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.1 );
    hemiLight.color.setHSL( 0.6, 0.6, 0.6 );
    hemiLight.groundColor.setHSL( 0.1, 1, 0.4 );
    hemiLight.position.set( 0, 50, 0 );
    scene.add( hemiLight );

    //Add directional light
    dirLight = new THREE.DirectionalLight( 0xffffff , 1);
    dirLight.color.setHSL( 0.1, 1, 0.95 );
    dirLight.position.set( -1, 1.75, 1 );
    dirLight.position.multiplyScalar( 100 );
    scene.add( dirLight );

    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;

    let d = 50;

    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;

    dirLight.shadow.camera.far = 13500;
    onWindowResize();
    window.addEventListener("resize", onWindowResize);

}


function animationLoop(){
    t0 += 1
    if (t0 % (rigidBodies.length) == 0) {
        spawnObjects();
        t0 = 0;
    }
    guiParams.objects_in_scene = rigidBodies.length - 2;

    let deltaTime = clock.getDelta();
    floorUniforms.u_time.value += 0.05;
    controls.update(deltaTime);
    // Limit FlyControls
    camera.position.y = 5;

    updatePhysics(deltaTime);

    renderer.render( scene, camera );
    requestAnimationFrame( animationLoop );
}

function createFloor(){
    
    let pos = {x: 0, y: 0, z: 0};
    let scale = {x: 200, y: 1, z: 200};
    let quat = {x: 0, y: 0, z: 0, w: 1};
    let mass = 0;

    //threeJS Section
    let blockPlane = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial({
        uniforms: floorUniforms,
        vertexShader: floorVert,
        fragmentShader: floorFrag,
      }));

    blockPlane.position.set(pos.x, pos.y, pos.z);
    blockPlane.scale.set(scale.x, scale.y, scale.z);

    blockPlane.castShadow = true;
    blockPlane.receiveShadow = true;

    scene.add(blockPlane);


    //Ammojs Section
    let transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
    transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
    let motionState = new Ammo.btDefaultMotionState( transform );

    let colShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
    colShape.setMargin( 0.05 );

    let localInertia = new Ammo.btVector3( 0, 0, 0 );
    colShape.calculateLocalInertia( mass, localInertia );

    let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
    rbInfo.set_m_restitution(0.8);
    let body = new Ammo.btRigidBody( rbInfo );


    physicsWorld.addRigidBody( body, colGroupPlane, colGroupA | colGroupB );
}


function createRandomColor() {
    return Math.floor(Math.random() * (1 << 24));
  }
  
function createBall(pos, radius){
    let quat = {x: 0, y: 0, z: 0, w: 1};
    let mass = 1;

    //threeJS Section
    let ball = new THREE.Mesh(new THREE.SphereGeometry(radius), new THREE.MeshPhongMaterial({
        color: createRandomColor(),
    }));

    ball.position.set(pos.x, pos.y, pos.z);
    
    ball.castShadow = true;
    ball.receiveShadow = true;

    scene.add(ball);


    //Ammojs Section
    let transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
    transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
    let motionState = new Ammo.btDefaultMotionState( transform );

    let colShape = new Ammo.btSphereShape( radius );
    colShape.setMargin( 0.05 );

    let localInertia = new Ammo.btVector3( 0, 0, 0 );
    colShape.calculateLocalInertia( mass, localInertia );

    let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
    rbInfo.set_m_restitution(0.8);
    let body = new Ammo.btRigidBody( rbInfo );


    physicsWorld.addRigidBody( body, colGroupB, colGroupA | colGroupPlane | colGroupB );
    
    ball.userData.physicsBody = body;
    rigidBodies.push(ball);
}

function spawnObjects() {
    guiParams.objects_spawned += 8;

    let rad = 0.5 + Math.random() * 5;
    let scale = {x: 3 + Math.random() * 7, y: 3 + Math.random() * 7., z: 3 + Math.random() * 7.};


    let pos1 = {x: 30, y: 30, z: -50}
    let pos2 = {x: -30, y: 30, z: 50}
    let pos3 = {x: 70, y: 30, z: 70}
    let pos4 = {x: -70, y: 30, z: -70}

    createBall(pos1, rad)
    createBall(pos2, rad)
    createBall(pos3, rad)
    createBall(pos4, rad)
    
    createBlock(pos1, scale)
    createBlock(pos2, scale)
    createBlock(pos3, scale)
    createBlock(pos4, scale)

}

function createBlock(pos, scale){
    
    let quat = {x: 0, y: 0, z: 0, w: 1};
    let mass = 0.3;

    //threeJS Section
    let block = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhongMaterial({
        color: createRandomColor(),
      }));

    block.position.set(pos.x, pos.y, pos.z);
    block.scale.set(scale.x, scale.y, scale.z);

    block.castShadow = true;
    block.receiveShadow = true;

    scene.add(block);


    //Ammojs Section
    let transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
    transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
    let motionState = new Ammo.btDefaultMotionState( transform );

    let colShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
    colShape.setMargin( 0.05 );

    let localInertia = new Ammo.btVector3( 0, 0, 0 );
    colShape.calculateLocalInertia( mass, localInertia );

    let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, colShape, localInertia );
    rbInfo.set_m_restitution(0.8);
    let body = new Ammo.btRigidBody( rbInfo );


    physicsWorld.addRigidBody( body, colGroupB, colGroupA | colGroupB | colGroupPlane);
    block.userData.physicsBody = body;
    rigidBodies.push(block)
}

function createJointObjects(){
    
    let pos1 = camera.position;
    let pos2 = camera.position;

    let radius = 1;
    let scale = {x: 8, y: 1, z: 1};
    let quat = {x: 0, y: 0, z: 0, w: 1};
    let mass1 = 0;
    let mass2 = 100;

    let transform = new Ammo.btTransform();

    //Sphere Graphics
    broom = new THREE.Mesh(new THREE.SphereBufferGeometry(radius), new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }));

    broom.castShadow = true;
    broom.receiveShadow = true;

    scene.add(broom);

    //Sphere Physics
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3( pos1.x, pos1.y, pos1.z ) );
    transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
    let motionState = new Ammo.btDefaultMotionState( transform );

    let sphereColShape = new Ammo.btSphereShape( radius );
    sphereColShape.setMargin( 0.05 );

    let localInertia = new Ammo.btVector3( 0, 0, 0 );
    sphereColShape.calculateLocalInertia( mass1, localInertia );

    let rbInfo = new Ammo.btRigidBodyConstructionInfo( mass1, motionState, sphereColShape, localInertia );
    let sphereBody = new Ammo.btRigidBody( rbInfo );

    physicsWorld.addRigidBody( sphereBody, colGroupA, colGroupPlane);

    broom.userData.physicsBody = sphereBody;
    rigidBodies.push(broom);    

    //Block Graphics
    let block = new THREE.Mesh(new THREE.BoxBufferGeometry(), new THREE.MeshPhongMaterial({color: 0xf78a1d}));

    block.position.set(pos2.x, pos2.y, pos2.z);
    block.scale.set(scale.x, scale.y, scale.z);

    block.castShadow = true;
    block.receiveShadow = true;

    scene.add(block);


    //Block Physics
    transform.setIdentity();
    transform.setOrigin( new Ammo.btVector3( pos2.x, pos2.y, pos2.z ) );
    transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
    motionState = new Ammo.btDefaultMotionState( transform );

    let blockColShape = new Ammo.btBoxShape( new Ammo.btVector3( scale.x * 0.5, scale.y * 0.5, scale.z * 0.5 ) );
    blockColShape.setMargin( 0.05 );

    localInertia = new Ammo.btVector3( 0, 0, 0 );
    blockColShape.calculateLocalInertia( mass2, localInertia );

    rbInfo = new Ammo.btRigidBodyConstructionInfo( mass2, motionState, blockColShape, localInertia );
    let blockBody = new Ammo.btRigidBody( rbInfo );
    blockBody.setDamping(0.5, 0.5);

    physicsWorld.addRigidBody( blockBody, colGroupB, colGroupPlane | colGroupB );
    
    block.userData.physicsBody = blockBody;
    rigidBodies.push(block);


    // Create Hinge Constraint
    let axis = new Ammo.btVector3(0, 1, 0); 
    let spherePivot = new Ammo.btVector3(0, 0, 0); 
    let blockPivot = new Ammo.btVector3(-scale.x * 0.7, 0, 0); 

    //let hinge = new Ammo.btHingeConstraint(sphereBody, blockBody, pivotA, pivotB, axis, axis);

    // Enable motor (optional)
    //hinge.enableAngularMotor(true, 1, 10);
    
    let hinge = new Ammo.btHingeConstraint(
        sphereBody, // bodyA
        blockBody,  // bodyB
        spherePivot,
        blockPivot,
        axis, // Axis of rotation, in this case, x-axis
        axis  // Axis perpendicular to hinge axis, in this case, x-axis
    );

    // Set limits for the hinge constraint (in radians)
    //hinge.setLimit(-Math.PI/2, Math.PI/2); // Example limits, adjust as needed

    physicsWorld.addConstraint(hinge, false);
}


function updatePhysics( deltaTime ){
    // Step world
    physicsWorld.stepSimulation( deltaTime, 10 );

    // Update rigid bodies
    for ( let i = 0; i < rigidBodies.length; i++ ) {
        let objThree = rigidBodies[ i ];
        let objAmmo = objThree.userData.physicsBody;
        let ms = objAmmo.getMotionState();
        if ( ms ) {

            ms.getWorldTransform( tmpTrans );
            let p = tmpTrans.getOrigin();
            let q = tmpTrans.getRotation();
            objThree.position.set( p.x(), p.y(), p.z() );
            objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );

            if (objThree.position.y < -5) {
                physicsWorld.removeRigidBody(objAmmo);
                scene.remove(objThree);
                rigidBodies.splice(i, 1);
                guiParams.objects_destroyed += 1;
                i--; 
            }
        }
    }
    // Manually update the position of the broom's physics body

    let broomAmmo = broom.userData.physicsBody;
    let broomTransform = new Ammo.btTransform();
    broomTransform.setIdentity();
    const offset = new THREE.Vector3(0, 0, -5);
    offset.applyQuaternion(camera.quaternion);
    broomTransform.setOrigin(new Ammo.btVector3(camera.position.x + offset.x, camera.position.y + offset.y, camera.position.z + offset.z));
    broomAmmo.setWorldTransform(broomTransform);
}