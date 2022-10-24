
window.onload = function init()
{
	const canvas = document.getElementById( "gl-canvas" );
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const renderer = new THREE.WebGLRenderer({canvas});
	renderer.setSize(canvas.width,canvas.height);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

	var camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.01, 1000);
	camera.rotation.y = 0.25 * Math.PI;
	camera.position.x = 15;
	camera.position.y = 15;
	camera.position.z = 15;

	const controls = new THREE.OrbitControls(camera, renderer.domElement);

	hlight = new THREE.AmbientLight (0x404040,1);
	scene.add(hlight);
	light = new THREE.PointLight(0xc4c4c4,1);
	light.position.set(0,3000,5000);
	scene.add(light);

	light2 = new THREE.PointLight(0xc4c4c4,1);
	light2.position.set(5000,1000,0);
	scene.add(light2);

	light3 = new THREE.PointLight(0xc4c4c4,1);
	light3.position.set(0,1000,-5000);
	scene.add(light3);

	light4 = new THREE.PointLight(0xc4c4c4,1);
	light4.position.set(-5000,3000,5000);
	scene.add(light4);

	hlight = new THREE.AmbientLight(0xffffff, 2);
	scene.add(hlight);
	
	const loader = new THREE.GLTFLoader();
	loader.load('./gltf/book/scene.gltf', function(gltf) {
		model = gltf.scene.children[0];
		model.scale.set(1.0,1.0,1.0);
		scene.add(gltf.scene);
		animate();
	}, undefined, function (error) {
		console.error(error);
	});

	function animate() {
		// rotate along with X-axis
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
	}

}
