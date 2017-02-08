var $html = document.documentElement;
var $body = document.body;

var $vh_top = document.getElementById('vh-top');
var $vw_top = document.getElementById('vw-top');
var $vh_bot = document.getElementById('vh-bot');
var $vw_bot = document.getElementById('vw-bot');

var $x = document.getElementById('x');
var $y = document.getElementById('y');

var $xp = document.getElementById('xp');
var $yp = document.getElementById('yp');



function scrollInfo(){
	// yay, browser compatibility! And it's not even IE's fault!
	// Further Reading: https://miketaylr.com/posts/2014/11/document-body-scrollTop.html
	var top =  $html.scrollTop  || $body.scrollTop;
	var left = $html.scrollLeft || $body.scrollLeft;
	
	$x.innerHTML = left;
	$y.innerHTML = top;
	
	$xp.innerHTML = Math.round( (100 * left / $html.clientWidth) * 10000 ) / 10000;
	$yp.innerHTML = Math.round( (100 * top  / $html.clientHeight) * 10000 ) / 10000;
}
$html.onscroll = scrollInfo; // this, however, is IE again
$body.onscroll = scrollInfo;

function resizeInfo(){
	$vh_top.innerHTML = $vh_bot.innerHTML = $html.clientHeight;
	$vw_top.innerHTML = $vw_bot.innerHTML = $html.clientWidth;
}
//$html.onresize = resizeInfo;
// $body.onresize = function(){...} bugs out on chrome after a few seconds. interesting!
$body.onresize = resizeInfo;

$body.onresize();