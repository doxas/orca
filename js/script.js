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
var camQtn = qtn.identity(qtn.create());
var rad = new radian();

var scene = 0;
var count = 0;
var score = 0;
var run = true;
var pi  = Math.PI;

var torna;

// events
// var kSpace      = new keys();
// var kEnter      = new keys();
// var kZkey       = new keys();
// var kXkey       = new keys();
// var kCkey       = new keys();
var kArrowUp    = new keys();
var kArrowRight = new keys();
var kArrowDown  = new keys();
var kArrowLeft  = new keys();
var deviceOrientUpdate = false;

// audio
var audioCtr = new AudioCtr(0.5, 0.5);

window.onload = function(){
	var i = 0;
	screenCanvas = document.getElementById('canvas');
	screenSize = Math.min(window.innerWidth, window.innerHeight);
	screenCanvas.width  = screenSize;
	screenCanvas.height = screenSize;
	screenWidth  = screenCanvas.width;
	screenHeight = screenCanvas.height;
	screenAspect = screenWidth / screenHeight;
	w.init(screenCanvas);
	do{
		i++;
		offScreenSize = Math.pow(2, i);
	}while(Math.pow(2, i + 1) < screenSize);
	offScreenSize = Math.min(512, offScreenSize);
	bufferSize = offScreenSize;
	
	window.addEventListener('keydown', keyDown, true);
	window.addEventListener('keyup', keyUp, true);
	window.addEventListener("deviceorientation", deviceOrientation);
	
	// audioCtr.load('http://game.wgld.org/raychintv/snd/background.mp3', 0, true, true);
	// audioCtr.load('http://game.wgld.org/raychintv/snd/bomb.mp3', 1, false, false);
	// audioCtr.load('http://game.wgld.org/raychintv/snd/hit.mp3', 2, false, false);
	// audioCtr.load('http://game.wgld.org/raychintv/snd/powerhit.mp3', 3, false, false);
	// audioCtr.load('http://game.wgld.org/raychintv/snd/shot.mp3', 4, false, false);
	// audioCtr.load('http://game.wgld.org/raychintv/snd/damage.mp3', 5, false, false);
	
	var e = document.getElementById('info');
	e.innerText = 'loading...';
	
	main();
};

function main(){
	var ease5 = new Array();
	var ease10 = new Array();
	var ease20 = new Array();
	var ease30 = new Array();
	
	// shader program initialize phase ----------------------------------------
	var basePrg = w.generate_program(
		'baseVS',
		'baseFS',
		['position'],
		[3],
		['mvpMatrix', 'ambient'],
		['matrix4fv', '4fv']
	);
	
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
	
	// blur programs ----------------------------------------------------------
	var blurPrg = w.generate_program(
		'blurVS',
		'blurFS',
		['position', 'texCoord'],
		[3, 2],
		['mvpMatrix', 'texture', 'weight', 'resolution', 'horizon'],
		['matrix4fv', '1i', '1fv', '1f', '1i']
	);
	
	// board
	var bIndex = [0, 1, 2, 3];
	var board = w.create_vbo(bIndex);
	var boardVBOList = [board];
	var boardPosition = new Array();
	var boardColor = new Array();
	var boardCoord = new Array();
	var idx = [0, 2, 1, 1, 2, 3];
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
		0.0, 1.0,
		0.0, 0.0,
		1.0, 1.0,
		1.0, 0.0
	];
	
	// ortho
	var pos = [
	   -1.0,  1.0,  0.0,
		1.0,  1.0,  0.0,
	   -1.0, -1.0,  0.0,
		1.0, -1.0,  0.0
	];
	var tex = [
		0.0, 0.0,
		1.0, 0.0,
		0.0, 1.0,
		1.0, 1.0
	];
	
	var blurVBOList = [w.create_vbo(pos), w.create_vbo(tex)];
	var blurIBO = w.create_ibo(idx);
	var blurIndexLength = idx.length;
	
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
	
	// matrix and other data initialize phase ---------------------------------
	var mMatrix   = mat.identity(mat.create());
	var vMatrix   = mat.identity(mat.create());
	var pMatrix   = mat.identity(mat.create());
	var tmpMatrix = mat.identity(mat.create());
	var mvpMatrix = mat.identity(mat.create());
	var ortMatrix = mat.identity(mat.create());
	
	// ortho
	mat.lookAt([0.0, 0.0, 0.5], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0], vMatrix);
	mat.ortho(-1.0, 1.0, 1.0, -1.0, 0.1, 1.0, pMatrix);
	mat.multiply(pMatrix, vMatrix, ortMatrix);
	
	// camera and scene
	var camPosition = [0.0, 0.0, 10.0];
	var camUp       = [0.0, 1.0, 0.0];
	mat.lookAt(camPosition, [0.0, 0.0, 0.0], camUp, vMatrix);
	mat.perspective(45, 1.0, 0.1, 15.0, pMatrix);
	mat.multiply(pMatrix, vMatrix, tmpMatrix);
	
	// texture initialize phase -----------------------------------------------
	//w.create_texture('img/chip.png', 0);
	
	// frame buffer  initialize phase -----------------------------------------
	noiseBuffer = w.create_framebuffer(bufferSize, bufferSize);
	offScreenBuffer = w.create_framebuffer(offScreenSize, offScreenSize);
	hBlurBuffer = w.create_framebuffer(offScreenSize, offScreenSize);
	vBlurBuffer = w.create_framebuffer(offScreenSize, offScreenSize);
	
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
	
	// char
	torna = new Char();
	torna.init();
	
	// render -----------------------------------------------------------------
	w.gl.activeTexture(w.gl.TEXTURE0);
	w.gl.bindTexture(w.gl.TEXTURE_2D, noiseBuffer.t);
	
	// loading wait -----------------------------------------------------------
	(function(){
		// if(audioCtr.loadComplete() && w.texture[0] != null){
		// 	// background music play
		// 	audioCtr.src[0].play();
		//	
		// 	// dom update
		// 	document.getElementById('info').innerText = 'done';
		//	
		// 	// renderer
		// 	render();
		// }else{
		// 	setTimeout(arguments.callee, 100);
		// }
		render();
	})();
	
	// render function --------------------------------------------------------
	function render(){
		var i;
		var gl = w.gl;
		
		// initialize
		count++;
		deviceOrientUpdate = false;
		gl.clear(gl.COLOR_BUFFER_BIT);
		
		// update keys ````````````````````````````````````````````````````````
		keyUpdate();
		
		// off screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenBuffer.f);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, offScreenSize, offScreenSize);
		
		
		// char fase
		torna.update();
		basePrg.set_program();
		charRender();
		
		// horizon blur
		gl.bindTexture(gl.TEXTURE_2D, offScreenBuffer.t);
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
		
		// board
		gl.bindTexture(gl.TEXTURE_2D, vBlurBuffer.t);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.viewport(0, 0, screenSize, screenSize);
		boardPrg.set_program();
		boardPrg.set_attribute(boardVBOList);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boardIndex);
		boardPrg.push_shader([boardPosition[B_FULL], boardCoord[B_FULL], 0, true, [1.25, 1.25, 1.25, 1.0]]);
		gl.drawElements(gl.TRIANGLES, boardIndexLength, gl.UNSIGNED_SHORT, 0);
		
		
		basePrg.set_program();
		charRender();
		
		
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
	}
}

// event and utility function =================================================
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
	}                                       // escape
//	if(ck === 13){kEnter.update(1);}        // enter
//	if(ck === 32){kSpace.update(1);}        // space
	if(ck === 37){kArrowLeft.update(1);}    // left
	if(ck === 38){kArrowUp.update(1);}      // up
	if(ck === 39){kArrowRight.update(1);}   // right
	if(ck === 40){kArrowDown.update(1);}    // down
	// if(ck === 90){kZkey.update(1);}         // z
//	if(ck === 88){kXkey.update(1);}         // x
//	if(ck === 67){kCkey.update(1);}         // c
}

function keyUp(e){
	var ck = e.keyCode;
//	if(ck === 27){run = false;}             // escape
//	if(ck === 13){kEnter.update(2);}        // enter
//	if(ck === 32){kSpace.update(2);}        // space
	if(ck === 37){kArrowLeft.update(2);}    // left
	if(ck === 38){kArrowUp.update(2);}      // up
	if(ck === 39){kArrowRight.update(2);}   // right
	if(ck === 40){kArrowDown.update(2);}    // down
	// if(ck === 90){kZkey.update(2);}         // z
//	if(ck === 88){kXkey.update(2);}         // x
//	if(ck === 67){kCkey.update(2);}         // c
}

function keyUpdate(){
//	kEnter.update(0);
//	kSpace.update(0);
	kArrowLeft.update(0);
	kArrowUp.update(0);
	kArrowRight.update(0);
	kArrowDown.update(0);
	// kZkey.update(0);
//	kXkey.update(0);
//	kCkey.update(0);
}

function keys(){
	this.down  = false;
	this.press = false;
	this.up    = false;
	this.count = 0;
	this.update = function(flg){
		if(flg == 0){
			if(this.down){this.down = false;}
			if(this.up){this.up = false;}
			if(this.press){this.count++;}
		}else if(flg == 1){
			this.down = true;
			this.up = false;
			this.press = true;
		}else if(flg == 2){
			this.down = false;
			this.up = true;
			this.press = false;
			this.count = 0;
		}
	};
}

// mobile events
function deviceOrientation(eve){
	if(deviceOrientUpdate){return;}
	deviceOrientUpdate = true;
	if(torna != null){
		var x = eve.beta;
		var y = eve.gamma;
		var vx = 0, vy = 0;
		switch(true){
			case x > 5:
				vx = Math.min(x, 10.0);
				break;
			case x < 5:
				vx = Math.max(x, -10.0);
				break;
		}
		switch(true){
			case y > 5:
				vy = Math.min(y, 10.0);
				break;
			case y < 5:
				vy = Math.max(y, -10.0);
				break;
		}
		torna.vpos.y += 0.004 * -(vx / 20);
		torna.vpos.x += 0.004 * (vy / 20);
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

