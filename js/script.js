// ----------------------------------------------------------------------------
//
// orca
//
// ----------------------------------------------------------------------------

// global
var screenCanvas, screenWidth, screenHeight, screenAspect;
var noiseBuffer, offScreenBuffer, hBlurBuffer, vBlurBuffer;
var screenSize = 512;
var bufferSize = 512;
var offScreenSize = 512;
var w   = new wgld();
var mat = new matIV();
var qtn = new qtnIV();
var rad = new radian();
var camQtn = qtn.identity(qtn.create());

var scene = 0;
var count = 0;
var startTimes = 0;
var getTimes = 0;
var run = true;
var pi  = Math.PI;

var torna = null;
var jsonData = null;
var jsonLoaded = false;

// events

// audio
var audioCtr = new AudioCtr(0.5, 0.5);

window.onload = function(){
	var i = 0;
	screenCanvas = document.getElementById('canvas');
	screenSize = Math.min(window.innerWidth, window.innerHeight);
	screenCanvas.width  = window.innerWidth;
	screenCanvas.height = screenSize;
	screenWidth  = screenCanvas.width;
	screenHeight = screenCanvas.height;
	screenAspect = screenWidth / screenHeight;
	w.init(screenCanvas);
	do{
		i++;
		offScreenSize = Math.pow(2, i);
	}while(Math.pow(2, i + 1) < screenSize);
	offScreenSize = Math.min(1024, offScreenSize);
	bufferSize = offScreenSize;

	window.addEventListener('keydown', keyDown, true);

	audioCtr.load('snd/bgm3.mp3', 0, true, true);

	var e = document.getElementById('info');
	e.innerText = 'loading...';

	main();
};

function main(){
	var i, j;
	var ease5  = [];
	var ease10 = [];
	var ease20 = [];
	var ease30 = [];

	// line base shader program -----------------------------------------------
	var basePrg = w.generate_program(
		'baseVS',
		'baseFS',
		['position'],
		[3],
		['mvpMatrix', 'ambient'],
		['matrix4fv', '4fv']
	);

	// board rect program -----------------------------------------------------
	var boardPrg = w.generate_program(
		'boardVS',
		'boardFS',
		['index'],
		[1],
		['position', 'texCoord', 'texture', 'tex', 'bgcolor'],
		['3fv', '2fv', '1i', '1i', '4fv']
	);

	// noise programs ---------------------------------------------------------
	var noisePrg = w.generate_program(
		'noiseVS',
		'noiseFS',
		['position'],
		[3],
		['map', 'mapSize', 'resolution'],
		['1i', '1f', '2fv']
	);

	// glow programs ----------------------------------------------------------
	var glowPrg = w.generate_program(
		'glowVS',
		'glowFS',
		['position'],
		[3],
		['mode', 'time', 'resolution', 'texture'],
		['1i', '1f', '2fv', '1i']
	);

	// edge programs ----------------------------------------------------------
	var edgePrg = w.generate_program(
		'edgeVS',
		'edgeFS',
		['position', 'texCoord'],
		[3, 2],
		['mvpMatrix', 'texture', 'kernel', 'resolution'],
		['matrix4fv', '1i', '1fv', '1f']
	);

	// blur programs ----------------------------------------------------------
	var blurPrg = w.generate_program(
		'blurVS',
		'blurFS',
		['position', 'texCoord'],
		[3, 2],
		['mvpMatrix', 'texture', 'weight', 'resolution', 'horizon'],
		['matrix4fv', '1i', '1fv', '1f', '1i']
	);

	// color programs ---------------------------------------------------------
	var colorPrg = w.generate_program(
		'colorVS',
		'colorFS',
		['position', 'normal', 'color', 'texCoord', 'type'],
		[3, 3, 4, 2, 1],
		['mMatrix', 'mvpMatrix', 'invMatrix', 'lightPosition', 'eyePosition', 'canterPoint', 'ambient', 'mode', 'texture'],
		['matrix4fv', 'matrix4fv', 'matrix4fv', '3fv', '3fv', '3fv', '4fv', '1i', '1i']
	);

	// board
	var bIndex = [0, 1, 2, 3];
	var board = w.create_vbo(bIndex);
	var boardVBOList = [board];
	var boardPosition = new Array();
	var boardColor = new Array();
	var boardCoord = new Array();
	var idx = [0, 1, 2, 2, 1, 3];
	var boardIndex = w.create_ibo(idx);
	var boardIndexLength = idx.length;

	// board const
	var B_FULL = 0;

	// board - full
	boardPosition[B_FULL] = [
		-1.0,  1.0,  0.0,
		-1.0, -1.0,  0.0,
		 1.0,  1.0,  0.0,
		 1.0, -1.0,  0.0
	];
	boardColor[B_FULL] = [1.0, 1.0, 1.0, 1.0];
	boardCoord[B_FULL] = [
		0.0, 0.0,
		0.0, 1.0,
		1.0, 0.0,
		1.0, 1.0
	];

	var blurVBOList = [w.create_vbo(boardPosition[B_FULL]), w.create_vbo(boardCoord[B_FULL])];
	var blurIBO = w.create_ibo(idx);
	var blurIndexLength = idx.length;

	var innerData = [];
	innerData[0]  = sphere(16, 16, 1.0, [1.0, 0.0, 0.0, 1.0], [ 0.0,  0.0,  0.0], [1.0, 1.0, 1.0], 0.0);
	innerData[1]  = sphere(16, 16, 2.0, [0.0, 1.0, 0.0, 1.0], [ 0.5,  1.0,  0.8], [1.0, 0.3, 0.3], 1.0);
	innerData[2]  = sphere(16, 16, 3.0, [0.0, 0.0, 1.0, 1.0], [ 1.2,  0.2, -1.6], [0.8, 0.1, 0.1], 2.0);
	innerData[3]  = sphere(16, 16, 3.0, [0.0, 0.0, 1.0, 1.0], [ 1.6, -0.3, -2.0], [0.8, 0.1, 0.1], 2.0);
	innerData[4]  = sphere(16, 16, 3.0, [0.0, 0.0, 1.0, 1.0], [ 2.4, -0.8, -2.4], [0.8, 0.1, 0.1], 2.0);
	innerData[5]  = sphere(16, 16, 2.0, [1.0, 1.0, 0.0, 1.0], [-0.8, -0.5,  0.8], [0.5, 0.3, 0.3], 3.0);
	innerData[6]  = sphere(16, 16, 3.0, [1.0, 0.0, 1.0, 1.0], [-0.5, -0.8, -1.2], [0.6, 0.3, 0.3], 4.0);
	innerData[7]  = sphere(16, 16, 2.0, [0.0, 1.0, 1.0, 1.0], [-0.8, -1.6,  1.6], [1.0, 0.3, 0.3], 5.0);
	innerData[8]  = sphere(16, 16, 2.0, [0.8, 0.8, 0.8, 1.0], [ 1.8,  1.2, -1.6], [1.0, 0.5, 0.5], 6.0);
	innerData[9]  = sphere(16, 16, 2.0, [0.5, 0.5, 0.5, 1.0], [ 1.6,  0.2,  1.6], [1.0, 0.3, 0.3], 7.0);
	innerData[10] = sphere(16, 16, 3.0, [1.0, 0.0, 1.0, 1.0], [ 1.8, -0.5,  2.0], [0.4, 0.1, 0.1], 4.0);
	innerData[11] = sphere(16, 16, 2.0, [0.0, 1.0, 1.0, 1.0], [ 0.2,  1.6,  0.2], [0.5, 0.3, 0.3], 5.0);
	innerData[12] = sphere(16, 16, 2.0, [0.0, 1.0, 0.0, 1.0], [-1.6,  1.8,  1.0], [1.0, 0.3, 0.3], 1.0);
	innerData[13] = sphere(16, 16, 1.0, [1.0, 1.0, 0.0, 1.0], [ 1.2, -1.5,  0.8], [0.3, 0.3, 0.3], 3.0);
	innerData[14] = sphere(16, 16, 4.0, [0.5, 0.5, 0.5, 1.0], [-3.0,  0.2,  0.0], [0.3, 0.3, 0.3], 7.0);
	innerData[15] = sphere(16, 16, 1.0, [0.8, 0.8, 0.8, 1.0], [ 1.8, -2.0, -0.8], [0.5, 0.5, 0.5], 6.0);
	innerData[16] = sphere(16, 16, 1.5, [1.0, 0.2, 0.2, 1.0], [ 4.0,  0.0,  0.0], [1.0, 1.0, 1.0], 1.0);
	innerData[17] = sphere(13, 13, 1.3, [1.0, 0.2, 0.2, 1.0], [ 8.0,  0.0,  0.0], [1.0, 1.0, 1.0], 2.0);
	innerData[18] = sphere(10, 10, 1.1, [1.0, 0.2, 0.2, 1.0], [11.0,  0.0,  0.0], [1.0, 1.0, 1.0], 3.0);
	innerData[19] = sphere( 8,  8, 0.9, [1.0, 0.2, 0.2, 1.0], [13.0,  0.0,  0.0], [1.0, 1.0, 1.0], 4.0);
	innerData[20] = sphere( 8,  8, 0.6, [1.0, 0.2, 0.2, 1.0], [15.0,  0.0,  0.0], [1.0, 1.0, 1.0], 5.0);
	innerData[21] = sphere( 4,  4, 0.4, [1.0, 0.2, 0.2, 1.0], [16.0,  0.0,  0.0], [1.0, 1.0, 1.0], 6.0);
	innerData[22] = sphere( 4,  4, 0.3, [1.0, 0.2, 0.2, 1.0], [16.5,  0.0,  0.0], [1.0, 1.0, 1.0], 7.0);
	innerData[23] = sphere( 2,  2, 0.2, [1.0, 0.2, 0.2, 1.0], [16.75, 0.0,  0.0], [1.0, 1.0, 1.0], 1.0);
	for(i = 1, j = innerData.length; i < j; i++){
		mergeIndex(innerData[0], innerData[i]);
	}
	var innerPosition    = w.create_vbo(innerData[0].position);
	var innerNormal      = w.create_vbo(innerData[0].normal);
	var innerColor       = w.create_vbo(innerData[0].color);
	var innerTexCoord    = w.create_vbo(innerData[0].texCoord);
	var innerType        = w.create_vbo(innerData[0].type);
	var innerVBOList     = [innerPosition, innerNormal, innerColor, innerTexCoord, innerType];
	var innerIndex       = w.create_ibo(innerData[0].index);
	var innerIndexLength = innerData[0].index.length;

	// box lines
	// var boxData = box(2.0);
	var boxData = ball(3, 3, 2.0);
	var boxPosition    = w.create_vbo(boxData.position);
	var boxVBOList     = [boxPosition];
	var boxIndexLength = boxData.position.length / 3;

	// ball lines
	var ballData = ball(6, 6, 1.5);
	var ballPosition    = w.create_vbo(ballData.position);
	var ballVBOList     = [ballPosition];
	var ballIndexLength = ballData.position.length / 3;

	// noise
	var noiseData = plane(1.0);
	var noisePosition    = w.create_vbo(noiseData.position);
	var noiseVBOList     = [noisePosition];
	var noiseIndex       = w.create_ibo(noiseData.index);
	var noiseIndexLength = noiseData.index.length;

	// json
	var jsonPosition = null;
	var jsonnormal   = null;
	var jsoncolor    = null;
	var jsontexcoord = null;
	var jsonvbolist  = null;
	var jsonindex    = null;
	var jsonindexlength = 0;
	jsonLoader('mdl/whale.json');

	// matrix and other data initialize phase ---------------------------------
	var mMatrix   = mat.identity(mat.create());
	var vMatrix   = mat.identity(mat.create());
	var pMatrix   = mat.identity(mat.create());
	var tmpMatrix = mat.identity(mat.create());
	var mvpMatrix = mat.identity(mat.create());
	var invMatrix = mat.identity(mat.create());
	var ortMatrix = mat.identity(mat.create());

	// ortho
	mat.lookAt([0.0, 0.0, 0.5], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
	mat.ortho(-1.0, 1.0, 1.0, -1.0, 0.1, 1.0, pMatrix);
	mat.multiply(pMatrix, vMatrix, ortMatrix);

	// texture initialize phase -----------------------------------------------
	w.create_texture('img/chip.png', 0);

	// frame buffer  initialize phase -----------------------------------------
	noiseBuffer     = w.create_framebuffer(bufferSize, bufferSize);
	offScreenBuffer = w.create_framebuffer(offScreenSize, offScreenSize);
	offSecondBuffer = w.create_framebuffer(offScreenSize, offScreenSize);
	hBlurBuffer     = w.create_framebuffer(offScreenSize, offScreenSize);
	vBlurBuffer     = w.create_framebuffer(offScreenSize, offScreenSize);
	edgeBuffer      = w.create_framebuffer(offScreenSize, offScreenSize);

	// noise data initialize --------------------------------------------------
	w.gl.bindFramebuffer(w.gl.FRAMEBUFFER, noiseBuffer.f);
	w.gl.clearColor(0.0, 0.0, 0.0, 1.0);
	w.gl.clear(w.gl.COLOR_BUFFER_BIT);
	w.gl.viewport(0, 0, bufferSize, bufferSize);
	noisePrg.set_program();
	noisePrg.set_attribute(noiseVBOList);
	w.gl.bindBuffer(w.gl.ELEMENT_ARRAY_BUFFER, noiseIndex);
	noisePrg.push_shader([true, bufferSize, [bufferSize, bufferSize]]);
	w.gl.drawElements(w.gl.TRIANGLES, noiseIndexLength, w.gl.UNSIGNED_SHORT, 0);
	w.gl.flush();

	// initialize setting phase -----------------------------------------------
	w.gl.bindFramebuffer(w.gl.FRAMEBUFFER, null);
	w.gl.enable(w.gl.DEPTH_TEST);
	w.gl.depthFunc(w.gl.LEQUAL);
	w.gl.enable(w.gl.CULL_FACE);
	w.gl.enable(w.gl.BLEND);
	w.gl.blendFuncSeparate(w.gl.SRC_ALPHA, w.gl.ONE, w.gl.ONE, w.gl.ONE);
	w.gl.blendEquationSeparate(w.gl.FUNC_ADD, w.gl.FUNC_ADD);
	w.gl.clearColor(0.0, 0.0, 0.0, 1.0);
	w.gl.clearDepth(1.0);

	for(i = 0; i <= 5;  i++){ease5[i]  = easeOutCubic(i * 0.2);}
	for(i = 0; i <= 10; i++){ease10[i] = easeOutCubic(i * 0.1);}
	for(i = 0; i <= 20; i++){ease20[i] = easeOutCubic(i * (1 / 20));}
	for(i = 0; i <= 30; i++){ease30[i] = easeOutCubic(i * (1 / 30));}

	// gaussian weight
	var weight = new Array(5);
	var t = 0.0;
	var d = 50.0;
	for(var i = 0; i < weight.length; i++){
		var r = 1.0 + 2.0 * i;
		var v = Math.exp(-0.5 * (r * r) / d);
		weight[i] = v;
		if(i > 0){v *= 2.0;}
		t += v;
	}
	for(i = 0; i < weight.length; i++){
		weight[i] /= t;
	}

	// kernel
	var kernel = [
		1.0,  1.0,  1.0,
		1.0, -8.0,  1.0,
		1.0,  1.0,  1.0
	];

	// char
	torna = new Char();
	torna.init();

	// variable initialize
	startTimes = Date.now();

	// render -----------------------------------------------------------------
	w.gl.activeTexture(w.gl.TEXTURE0);
	w.gl.bindTexture(w.gl.TEXTURE_2D, noiseBuffer.t);

	// loading wait -----------------------------------------------------------
	(function(){
		if(audioCtr.loadComplete() && w.texture[0] != null && jsonLoaded){
			// background music play
			audioCtr.src[0].play();
		
			// dom update
			document.getElementById('info').innerText = 'done';
		
			// jsondata initialize phase --------------------------------------
			jsonData.color = [];
			for(var i = 0, j = jsonData.vertex; i < j; i++){
				jsonData.color.push(1.0, 1.0, 1.0, 1.0);
			}
			jsonPosition = w.create_vbo(jsonData.position);
			jsonNormal   = w.create_vbo(jsonData.normal);
			jsonColor    = w.create_vbo(jsonData.color);
			jsonTexCoord = w.create_vbo(jsonData.texCoord);
			jsonVBOList  = [jsonPosition, jsonNormal, jsonColor, jsonTexCoord];
			jsonIndex    = w.create_ibo(jsonData.index);
			jsonIndexLength = jsonData.index.length;

			// renderer
			render();
		}else{
			setTimeout(arguments.callee, 100);
		}
	})();

	// render function --------------------------------------------------------
	function render(){
		var i;
		var gl = w.gl;
		getTimes = (Date.now() - startTimes) / 1000;

		// initialize
		count++;
		screenWidth = window.innerWidth;
		screenHeight = window.innerHeight;
		screenAspect = screenWidth / screenHeight;
		screenCanvas.width = screenWidth;
		screenCanvas.height = screenHeight;
		gl.enable(gl.BLEND);

		// camera and scene
		var camPosition = [0.0, 0.0, 20.0];
		var camCenter   = [0.0, 0.0, 0.0];
		var camUp       = [0.0, 1.0, 0.0];
		mat.lookAt(camPosition, camCenter, camUp, vMatrix);
		mat.perspective(45, screenAspect, 0.1, 50.0, pMatrix);
		mat.multiply(pMatrix, vMatrix, tmpMatrix);
		var lightPosition = [0.577, 0.577, 0.577];

		// off screen blend draw
		gl.bindFramebuffer(gl.FRAMEBUFFER, offSecondBuffer.f);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, offScreenSize, offScreenSize);

		offRender();

		// off screen
		gl.disable(gl.BLEND);
		gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenBuffer.f);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, offScreenSize, offScreenSize);

		// // char fase
		// torna.update();
		// basePrg.set_program();
		// charRender();

		offRender();

		// edge
		gl.bindTexture(gl.TEXTURE_2D, offScreenBuffer.t);
		gl.bindFramebuffer(gl.FRAMEBUFFER, edgeBuffer.f);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, offScreenSize, offScreenSize);

		edgePrg.set_program();
		edgePrg.set_attribute(blurVBOList);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, blurIBO);
		edgePrg.push_shader([ortMatrix, 0, kernel, offScreenSize]);
		gl.drawElements(gl.TRIANGLES, blurIndexLength, gl.UNSIGNED_SHORT, 0);

		// horizon blur
		gl.bindTexture(gl.TEXTURE_2D, edgeBuffer.t);
		gl.bindFramebuffer(gl.FRAMEBUFFER, hBlurBuffer.f);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, offScreenSize, offScreenSize);

		blurPrg.set_program();
		blurPrg.set_attribute(blurVBOList);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, blurIBO);
		blurPrg.push_shader([ortMatrix, 0, weight, offScreenSize, true]);
		gl.drawElements(gl.TRIANGLES, blurIndexLength, gl.UNSIGNED_SHORT, 0);

		// vertical blur
		gl.bindTexture(gl.TEXTURE_2D, hBlurBuffer.t);
		gl.bindFramebuffer(gl.FRAMEBUFFER, vBlurBuffer.f);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, offScreenSize, offScreenSize);

		blurPrg.push_shader([ortMatrix, 0, weight, offScreenSize, false]);
		gl.drawElements(gl.TRIANGLES, blurIndexLength, gl.UNSIGNED_SHORT, 0);

		// final scene
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, screenWidth, screenHeight);
		gl.enable(gl.BLEND);

		// board
		boardPrg.set_program();
		boardPrg.set_attribute(boardVBOList);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boardIndex);
		// color
		gl.bindTexture(gl.TEXTURE_2D, offSecondBuffer.t);
		boardPrg.push_shader([boardPosition[B_FULL], boardCoord[B_FULL], 0, true, [1.0, 1.0, 1.0, 1.0]]);
		gl.drawElements(gl.TRIANGLES, boardIndexLength, gl.UNSIGNED_SHORT, 0);
		// edge blur
		gl.bindTexture(gl.TEXTURE_2D, vBlurBuffer.t);
		boardPrg.push_shader([boardPosition[B_FULL], boardCoord[B_FULL], 0, true, [1.5, 1.5, 1.5, 1.0]]);
		gl.drawElements(gl.TRIANGLES, boardIndexLength, gl.UNSIGNED_SHORT, 0);
		// edge line
		gl.bindTexture(gl.TEXTURE_2D, edgeBuffer.t);
		boardPrg.push_shader([boardPosition[B_FULL], boardCoord[B_FULL], 0, true, [1.0, 1.0, 1.0, 1.0]]);
		gl.drawElements(gl.TRIANGLES, boardIndexLength, gl.UNSIGNED_SHORT, 0);

		gl.bindTexture(gl.TEXTURE_2D, noiseBuffer.t);
		glowPrg.set_program();
		glowPrg.set_attribute(noiseVBOList);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, noiseIndex);
		glowPrg.push_shader([0, getTimes, [screenWidth, screenHeight], 0]);
		gl.drawElements(gl.TRIANGLES, noiseIndexLength, gl.UNSIGNED_SHORT, 0);


		// finish
		gl.flush();
		if(run){requestAnimationFrame(render);}

		// char render
		function charRender(){
			// box
			basePrg.set_attribute(boxVBOList);
			mat.identity(mMatrix);
			mat.translate(mMatrix, [torna.position.x, torna.position.y, torna.position.z], mMatrix);
			mat.scale(mMatrix, [torna.size * 2, torna.size * 2, torna.size * 2], mMatrix);
			mat.rotate(mMatrix, rad.rad[count % 360], [0.0, 1.0, 1.0], mMatrix);
			mat.multiply(tmpMatrix, mMatrix, mvpMatrix);
			basePrg.push_shader([mvpMatrix, [1.0, 1.0, 1.0, 1.0]]);
			gl.drawArrays(gl.LINE_STRIP, 0, boxIndexLength);

			// ball
			basePrg.set_attribute(ballVBOList);
			mat.identity(mMatrix);
			mat.translate(mMatrix, [torna.position.x, torna.position.y, torna.position.z], mMatrix);
			mat.scale(mMatrix, [torna.size, torna.size, torna.size], mMatrix);
			mat.rotate(mMatrix, rad.rad[count % 360], [0.0, 1.0, 0.0], mMatrix);
			mat.multiply(tmpMatrix, mMatrix, mvpMatrix);
			basePrg.push_shader([mvpMatrix, [1.0, 0.0, 0.0, 1.0]]);
			gl.drawArrays(gl.LINE_STRIP, 0, ballIndexLength);
		}

		// offrender
		function offRender(){
			// inner
			var scaleCoef = audioCtr.src[0].onData[16] / 255;
			colorPrg.set_program();
			colorPrg.set_attribute(innerVBOList);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, innerIndex);
			mat.identity(mMatrix);
			mat.scale(mMatrix, [scaleCoef, scaleCoef, scaleCoef], mMatrix);
			mat.rotate(mMatrix, rad.rad[count % 360], [0.0, 1.0, 0.0], mMatrix);
			mat.multiply(tmpMatrix, mMatrix, mvpMatrix);
			mat.inverse(mMatrix, invMatrix);
			colorPrg.push_shader([
				mMatrix,
				mvpMatrix,
				invMatrix,
				lightPosition,
				camPosition,
				camCenter,
				[0.0, 0.0, 0.0, 1.0],
				3,
				0
			]);
			gl.drawElements(gl.TRIANGLES, innerIndexLength, gl.UNSIGNED_SHORT, 0);

			colorPrg.set_attribute(jsonVBOList);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, jsonIndex);
			mat.identity(mMatrix);
			mat.scale(mMatrix, [5.0, 5.0, 5.0], mMatrix);
			mat.rotate(mMatrix, rad.rad[count % 360], [0.0, 1.0, 1.0], mMatrix);
			mat.multiply(tmpMatrix, mMatrix, mvpMatrix);
			mat.inverse(mMatrix, invMatrix);
			colorPrg.push_shader([
				mMatrix,
				mvpMatrix,
				invMatrix,
				lightPosition,
				camPosition,
				camCenter,
				[0.0, 0.0, 0.0, 1.0],
				3,
				0
			]);
			gl.drawElements(gl.TRIANGLES, jsonIndexLength, gl.UNSIGNED_SHORT, 0);
		}
	}
}

// event and utility function =================================================
function mergeIndex(baseArr, concatArr){
	var i, j;
	var firstIndex = baseArr.position.length / 3;
	for(i = 0, j = concatArr.index.length; i < j; i++){
		baseArr.index.push(concatArr.index[i] + firstIndex);
	}
	baseArr.position = baseArr.position.concat(concatArr.position);
	baseArr.normal   = baseArr.normal.concat(concatArr.normal);
	baseArr.color    = baseArr.color.concat(concatArr.color);
	baseArr.texCoord = baseArr.texCoord.concat(concatArr.texCoord);
	baseArr.type     = baseArr.type.concat(concatArr.type);
}

function returnCoordArray(num, round){
	var i, j, k, l;
	var s = ('0000' + num).slice(-round);
	var n = new Array();
	var v = new Array();
	for(i = 0; i < round; i++){
		n[i] = parseInt(s.substr(i, 1));
		j = (n[i] % 4) * 0.25;
		k = Math.floor(n[i] / 4) * 0.25;
		v[i] = new Array(
			j, k, j, k + 0.25, j + 0.25, k, j + 0.25, k + 0.25
		);
	}
	return v;
}

function keyDown(e){
	var ck = e.keyCode;
	if(ck === 27){
		run = false;
		audioCtr.src[0].end(0);
	}else if(ck === 13){
		fullscreenRequest();
	}
}

function fullscreenRequest(){
	if(screenCanvas.requestFullscreen){
		screenCanvas.requestFullscreen();
	}else if(screenCanvas.webkitRequestFullscreen){
		screenCanvas.webkitRequestFullscreen();
	}else if(screenCanvas.mozRequestFullscreen){
		screenCanvas.mozRequestFullscreen();
	}else if(screenCanvas.msRequestFullscreen){
		screenCanvas.msRequestFullscreen();
	}
}
function easing(t){
	return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

function easeOutCubic(t){
	return (t = t / 1 - 1) * t * t + 1;
}

function easeQuintic(t){
	var ts = (t = t / 1) * t;
	var tc = ts * t;
	return (tc * ts);
}

// ajax json data load ========================================================
function jsonLoader(url){
	var xml = new XMLHttpRequest();
	xml.open('GET', url, true);
	
	xml.onload = function(){
		jsonLoaded = false;
		try{
			jsonData = JSON.parse(xml.response);
			jsonLoaded = true;
		}catch(err){
			console.log(err);
		}
	};
	xml.send();
}
