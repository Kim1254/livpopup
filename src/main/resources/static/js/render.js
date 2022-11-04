FOLD = require('fold');
window.addEventListener('resize', resizeEvent);

var canvas;

var renderer;
var camera;
var controls;

var repaint = false;

var timer_list = [];

window.onload = function init()
{
	canvas = document.getElementById("gl-canvas");
	
	var parser = new LPP.Parser("./tales/book1/config.json");
	parser.open();

	resizeEvent();

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);
	
	var li = 1;

	hlight = new THREE.AmbientLight(0x404040, li);
	scene.add(hlight);
	
	light = new THREE.PointLight(0xc4c4c4, li);
	light.position.set(0,3000,5000);
	scene.add(light);

	light2 = new THREE.PointLight(0xc4c4c4, li);
	light2.position.set(5000,1000,0);
	scene.add(light2);

	light3 = new THREE.PointLight(0xc4c4c4, li);
	light3.position.set(0,1000,-5000);
	scene.add(light3);

	light4 = new THREE.PointLight(0xc4c4c4, li);
	light4.position.set(-5000,3000,5000);
	scene.add(light4);
	
	const clock = new THREE.Clock();
	
	const loader = new THREE.GLTFLoader();
	loader.load('./gltf/book/scene.gltf', function(gltf) {
		model = gltf.scene.children[0];
		model.scale.set(1.0, 1.0, 1.0);
		
		mixer = new THREE.AnimationMixer(gltf.scene);
		
		const clip = THREE.AnimationClip.findByName(gltf.animations, 'BookOpen');
		const act = mixer.clipAction(clip);
		
		act.setLoop(0, 2);
		act.play();
		
		scene.add(gltf.scene);
		animate();
	}, undefined, function (error) {
		console.error(error);
	});

	function animate() {
		// rotate along with X-axis
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
		
		controls.update();
		
		mixer.update(clock.getDelta());
	}
}

function resizeEvent() {
	var width = window.innerWidth;
	var height = window.innerHeight;
	
	if (canvas.width != width || canvas.height != height)
	{
		canvas.width = width;
		canvas.height = height;
		
		renderer = new THREE.WebGLRenderer({canvas});
		renderer.setSize(width, height);

		camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
		camera.rotation.y = 0.25 * Math.PI;
		camera.position.x = 15;
		camera.position.y = 15;
		camera.position.z = 15;

		controls = new THREE.OrbitControls(camera, renderer.domElement);
		
		repaint = true;
	}
}
