// ----------------------------------------------------------------------------
// 
// torna-do char.js
// 
// ----------------------------------------------------------------------------

// box
function box(side){
	var hs = side * 0.5;
	var pos = [
		 hs,  hs,  hs,  hs,  hs, -hs,  hs, -hs,  hs,  hs, -hs, -hs,  hs,  hs,  hs, // px
		-hs,  hs,  hs, -hs,  hs, -hs, -hs, -hs,  hs, -hs, -hs, -hs, -hs,  hs,  hs, // nx
		-hs,  hs, -hs,  hs,  hs, -hs, -hs,  hs,  hs,  hs,  hs,  hs, -hs,  hs, -hs, // py
		-hs, -hs, -hs,  hs, -hs, -hs, -hs, -hs,  hs,  hs, -hs,  hs, -hs, -hs, -hs, // ny
		-hs,  hs,  hs, -hs, -hs,  hs,  hs,  hs,  hs,  hs, -hs,  hs, -hs,  hs,  hs, // pz
		-hs,  hs, -hs, -hs, -hs, -hs,  hs,  hs, -hs,  hs, -hs, -hs, -hs,  hs, -hs  // nz
	];
	var obj = new mesh();
	obj.position = pos;
	return obj;
}

// ball
function ball(row, col, side){
	if(row < 3 || col < 3){return null;}
	var obj = new mesh();
	var pos = [];
	var rSplit = (180 / (row - 1)) * Math.PI / 180;
	var cSplit = (180 / (col - 1)) * Math.PI / 180;
	for(var i = 0; i < row - 1; i++){
		var t = Math.cos(rSplit * i) * side;
		var n = Math.cos(rSplit * (i + 1)) * side;
		var v = Math.sin(rSplit * i) * side;
		var w = Math.sin(rSplit * (i + 1)) * side;
		for(var j = 0; j < col * 2 - 2; j++){
			var x = Math.sin(cSplit * j);
			var z = Math.cos(cSplit * j);
			var p = Math.sin(cSplit * (j + 1));
			var q = Math.cos(cSplit * (j + 1));
			pos.push(
				x * v, t, z * v,
				x * w, n, z * w,
				p * v, t, q * v,
				x * v, t, z * v
			);
		}
	}
	obj.position = pos;
	return obj;
}

// vector
function Vec(){
	this.x = this.y = this.z = 0.0;
}

Vec.prototype.arrow = function(v){
	var d = new Vec();
	d.x = v.x - this.x;
	d.y = v.y - this.y;
	d.z = v.z - this.z;
	return d;
};

Vec.prototype.length = function(){
	return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
};

Vec.prototype.normalize = function(){
	var l = 1 / this.length();
	this.x *= l;
	this.y *= l;
	this.z *= l;
};

// character
function Char(){
	this.position = new Vec();
	this.vpos = new Vec();
	this.speed = 0.02;
	this.life = 0;
	this.size = 0.25;
	this.alive = false;
}

Char.prototype.init = function(){
	this.position.x = 0.0;
	this.position.y = 0.0;
	this.position.z = 0.0;
	this.vpos.x = 0.0;
	this.vpos.y = 0.0;
	this.vpos.z = 0.0;
	this.alive = true;
}

Char.prototype.update = function(){
	this.vpos.x *= 0.975;
	this.vpos.y *= 0.975;
	this.vpos.z *= 0.975;
	if(Math.abs(this.vpos.x) < 0.0005){this.vpos.x = 0;}
	if(Math.abs(this.vpos.y) < 0.0005){this.vpos.y = 0;}
	if(Math.abs(this.vpos.z) < 0.0005){this.vpos.z = 0;}

	if(kArrowUp.press)   {this.vpos.y += 0.004;}
	if(kArrowRight.press){this.vpos.x += 0.004;}
	if(kArrowDown.press) {this.vpos.y -= 0.004;}
	if(kArrowLeft.press) {this.vpos.x -= 0.004;}
	if(this.vpos.x < -0.04){this.vpos.x = -0.04;}
	if(this.vpos.y < -0.04){this.vpos.y = -0.04;}
	if(this.vpos.x >  0.04){this.vpos.x =  0.04;}
	if(this.vpos.y >  0.04){this.vpos.y =  0.04;}

	this.position.x += this.vpos.x;
	this.position.y += this.vpos.y;
	this.position.z += this.vpos.z;
	if(this.position.x < -3.5){this.position.x = -3.5;}
	if(this.position.y < -3.5){this.position.y = -3.5;}
	if(this.position.x >  3.5){this.position.x =  3.5;}
	if(this.position.y >  3.5){this.position.y =  3.5;}
};

// shot
function Shot(){
	this.position = new Vec();
	this.vpos = new Vec();
	this.wpos = new Vec();
	this.vector = new Vec();
	this.alive = false;
	this.speed = 0;
	this.param = 0;
}

Shot.prototype.init = function(x, y, vx, vy, speed){
	this.alive = true;
	this.speed = speed;
	this.param = 0;
	this.position.x = x;  this.position.y = y;
	this.vpos.x     = x;  this.vpos.y     = y;
	this.wpos.x     = x;  this.wpos.y     = y;
	this.vector.x   = vx; this.vector.y   = vy;
};

Shot.prototype.update = function(){
	var i;
	if(this.alive){
		var x = this.vector.x * this.speed;
		var y = this.vector.y * this.speed;
		this.vpos.x = this.position.x + x * 0.55;
		this.vpos.y = this.position.y + y * 0.55;
		this.wpos.x = this.position.x + x * 0.05;
		this.wpos.y = this.position.y + y * 0.05;
		this.position.x += x;
		this.position.y += y;
		if(
			this.position.x < -1.1 ||
			this.position.x >  1.1 ||
			this.position.y < -1.1 ||
			this.position.y >  1.1
		){this.alive = false;}
	}
};

