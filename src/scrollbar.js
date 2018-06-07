// scrollbar.js v1.2.0 | MIT | https://github.com/desto-git/scrollbar.js
var scrollbarjs = (function(){ 'use strict';

/*
	TODO:
	min-width/height on thumbs!!!
	refactor global variables
	textareas
	right to left text
	some way to reliably add padding-right the viewport
	look for a way to get padding-bottom work without the ::after workaround. It just might resolve the padding-right problem as well.
	- `smooth: (boolean) [=true]` should the emulated scrolling be smoothed?
	- `easing: (function) [=easeInOutQuad]` https://gist.github.com/gre/1650294
	probably more

	a more attractive demo site which also explains things in its scrollable boxes

	css as .sass/.scss because variables are neat
*/

// don't forget to change your css accordingly
var PREFIX = 'scrollbarjs';

// distance to scroll when clicking
// int = px, float = %
// note however that 1.0 === 1, so it will be identified as an int. to say 100%, use something very close to it, e.g. 0.9999
var BUTTON_DISTANCE = 60; // on a button
var TRACK_DISTANCE  = 0.9; // somewhere on the track

var DELAY  = 200; // delay to wait in milliseconds before repeating the action
var REPEAT = 50; // repeat every x milliseconds

var INIT = false;
function init( data ){
	if( INIT ) return; // don't initiate more than once

	if( data !== undefined ){
		if( data.prefix ) PREFIX = data.prefix;
		if( data.buttonDistance ) BUTTON_DISTANCE = data.buttonDistance;
		if( data.trackDistance ) TRACK_DISTANCE = data.trackDistance;
		if( data.delay ) DELAY = data.delay;
		if( data.repeat ) REPEAT = data.repeat;
		if( data.useFlexbox ) USE_FLEXBOX = data.useFlexbox;
		if( data.styleResize ) STYLE_RESIZE = data.styleResize;
	}

	// inject required CSS into the page
	var $style = document.createElement('style');
	$style.innerHTML =
		'body.' + PREFIX + ' {' +
			'height: 100vh;' +
		'}' +

		'.' + PREFIX + '-drag {' + // don't trigger selection when dragging the thumbs - http://stackoverflow.com/a/4407335
			'-webkit-touch-callout: none;' +
			'-webkit-user-select: none;' +
			'-khtml-user-select: none;' +
			'-moz-user-select: none;' +
			'-ms-user-select: none;' +
			'user-select: none;' +
		'}' +

		'.' + PREFIX + ' {' +
			'overflow: hidden;' +
			'position: relative;' +
		'}' +

		'.' + PREFIX + '-viewport {' +
			'overflow: scroll;' +
			'margin-right: '  + -NATIVE_WIDTH  + 'px;' +
			'margin-bottom: ' + -NATIVE_HEIGHT + 'px;' +
		'}' +


		'.' + PREFIX + '-resizable {' + // resizing is done in js
			'resize: none!important;' +
		'}';
	document.head.appendChild( $style );

	INIT = true;
}

// end of settings



// below this point is calculated stuff

// to get the native width and height of a scrollbar, we create an element with overflow:scroll
// it will be removed right afterwards when we have the details we want
var NATIVE_WIDTH  = 0;
var NATIVE_HEIGHT = 0;

// scoping to pretent it didn't happen
(function(){
	var $scrollbar_wh = document.createElement('div');
	$scrollbar_wh.style.width = '100%'; // it needs to be bigger than the scrollbar, because we won't get a negative value in case it's not
	$scrollbar_wh.style.height = '100%';
	$scrollbar_wh.style.overflow = 'scroll'; // show scrollbars
	$scrollbar_wh.style.position = 'absolute'; // don't break the flow of the document in the process
	$scrollbar_wh.style.top = '-100%'; // hide
	document.body.appendChild( $scrollbar_wh );

	NATIVE_WIDTH  = $scrollbar_wh.offsetWidth  - $scrollbar_wh.clientWidth;
	NATIVE_HEIGHT = $scrollbar_wh.offsetHeight - $scrollbar_wh.clientHeight;

	$scrollbar_wh.parentElement.removeChild( $scrollbar_wh );
}());

var TID; // contains the timeout id so we can stop it
var IID; // interval id

var DRAG_MODE; // DRAG_SCROLL or DRAG_RESIZE
var DRAG_AXIS; // scroll vertically or horizontally?
var DRAG_DISTANCE; // distance to scroll in pixels for each pixel the thumb has been moved
var $DRAG_TARGET; // the content being scrolled
var VIEWPORT_SCROLLPOS; // the current x or y position as a double instead of an int, used to circumvent unprecise dragging

function reset(){
	clearInterval( IID );
	clearTimeout(  TID );
	DRAG_MODE = undefined;
	document.body.classList.remove( PREFIX + '-drag' );
	if( $DRAG_TARGET !== undefined ){
		$DRAG_TARGET.parentElement.classList.remove( PREFIX + '-active' );
		$DRAG_TARGET = undefined;
	}
}
document.body.addEventListener( 'mouseup', reset );
document.body.addEventListener( 'mouseenter', function( e ){
	// leaving browser window and going back in, check if left mouse button is "still" pressed
	if( ( e.buttons & 1 ) !== 1 ) reset();
} );

var LAST_X, LAST_Y; // last x y offset
var DRAG_MODE_SCROLL = 0;
var DRAG_MODE_RESIZE = 1;
document.body.addEventListener( 'mousemove', function( e ){
	if( DRAG_MODE === DRAG_MODE_SCROLL ){

		if( DRAG_AXIS === DRAG_VER ){
			VIEWPORT_SCROLLPOS += DRAG_DISTANCE * ( e.clientY - LAST_Y );
			scrollViewport( $DRAG_TARGET, null, Math.round( VIEWPORT_SCROLLPOS ), true );

		} else {
			VIEWPORT_SCROLLPOS += DRAG_DISTANCE * ( e.clientX - LAST_X );
			scrollViewport( $DRAG_TARGET, Math.round( VIEWPORT_SCROLLPOS ), null, true );
		}

	} else if( DRAG_MODE === DRAG_MODE_RESIZE ){
		// inconsistent behavior between browsers when resizing centered content
		// chrome's way makes more sense (resize by twice the amount to keep following the cursor properly)
		// but firefox' is easier to implement, as I don't need to check for all the ways the content could be centered (margin: 0 auto, flexbox, text-align,..?)
		var x = ( e.clientX - LAST_X );
		var y = ( e.clientY - LAST_Y );

		if( DRAG_AXIS !== DRAG_HOR  ){ // VER or BOTH
			var h = $DRAG_TARGET.clientHeight;
			$DRAG_TARGET.style.height = h + y + 'px';
			// verify if height is legit, e.g. in case max-height is set
			$DRAG_TARGET.style.height = getComputedStyle( $DRAG_TARGET )['height'];
		}

		if( DRAG_AXIS !== DRAG_VER  ){ // HOR or BOTH
			var w = $DRAG_TARGET.clientWidth;
			$DRAG_TARGET.style.width = w + x + 'px';
			$DRAG_TARGET.style.width = getComputedStyle( $DRAG_TARGET )['width'];
		}
	}

	LAST_X = e.clientX;
	LAST_Y = e.clientY;
} );



// event listeners
var BUTTON_UP    = 0;
var BUTTON_RIGHT = 1;
var BUTTON_DOWN  = 2;
var BUTTON_LEFT  = 3;
function clickButton( event, $viewport, direction ){
	if( event.button !== 0 ) return; // only work on left click
	//document.body.classList.add( PREFIX + '-drag' ); // disable selection of text
	switch( direction ){
		case BUTTON_UP:    scrollViewport( $viewport, 0, -BUTTON_DISTANCE ); break;
		case BUTTON_RIGHT: scrollViewport( $viewport, BUTTON_DISTANCE, 0  ); break;
		case BUTTON_DOWN:  scrollViewport( $viewport, 0, BUTTON_DISTANCE  ); break;
		case BUTTON_LEFT:  scrollViewport( $viewport, -BUTTON_DISTANCE, 0 ); break;
	}
}

var TRACK_UP    = 0;
var TRACK_RIGHT = 1;
var TRACK_DOWN  = 2;
var TRACK_LEFT  = 3;
function clickTrack( event, $viewport, direction ){
	if( event.button !== 0 ) return;
	//document.body.classList.add( PREFIX + '-drag' );
	switch( direction ){
		case TRACK_UP:    scrollViewport( $viewport, 0, -TRACK_DISTANCE ); break;
		case TRACK_RIGHT: scrollViewport( $viewport, TRACK_DISTANCE, 0  ); break;
		case TRACK_DOWN:  scrollViewport( $viewport, 0, TRACK_DISTANCE  ); break;
		case TRACK_LEFT:  scrollViewport( $viewport, -TRACK_DISTANCE, 0 ); break;
	}
}

var DRAG_VER = 0;
var DRAG_HOR = 1;
function clickThumb( event, $viewport, direction ){
	if( event.button !== 0 ) return;
	document.body.classList.add( PREFIX + '-drag' );
	$viewport.parentElement.classList.add( PREFIX + '-active' );

	DRAG_MODE = DRAG_MODE_SCROLL;
	DRAG_AXIS = direction;
	$DRAG_TARGET = $viewport;

	if( direction === DRAG_VER ){
		VIEWPORT_SCROLLPOS = $viewport.scrollTop;
		DRAG_DISTANCE = $viewport.scrollHeight / event.target.parentElement.clientHeight;
	} else {
		VIEWPORT_SCROLLPOS = $viewport.scrollLeft;
		DRAG_DISTANCE = $viewport.scrollWidth / event.target.parentElement.clientWidth;
	}
}

var DRAG_BOTH = 2;
function clickResize( event, $elem, direction ){
	if( event.button !== 0 ) return;
	document.body.classList.add( PREFIX + '-drag' );

	DRAG_MODE = DRAG_MODE_RESIZE;
	DRAG_AXIS = direction;
	$DRAG_TARGET = $elem;
}

// helper functions
var CLASS_SCROLL_NONE = PREFIX + '-scroll-none';
var CLASS_SCROLL_VER  = PREFIX + '-scroll-ver';
var CLASS_SCROLL_HOR  = PREFIX + '-scroll-hor';
var CLASS_SCROLL_BOTH = PREFIX + '-scroll-both';
function switchScrollClass( $elem, className ){
	if( $elem.classList.contains( className ) )
		return;

	$elem.classList.remove( CLASS_SCROLL_NONE );
	$elem.classList.remove( CLASS_SCROLL_VER  );
	$elem.classList.remove( CLASS_SCROLL_HOR  );
	$elem.classList.remove( CLASS_SCROLL_BOTH );
	$elem.classList.add( className );
}

function scrollViewport( $viewport, x, y, jump, repeat ){
	if( jump === undefined ) jump = false;
	if( repeat === undefined ) repeat = false;

	if( jump ){
		if( x !== null ) $viewport.scrollLeft = x;
		if( y !== null ) $viewport.scrollTop  = y;
	} else {
		if( x % 1 === 0 ) $viewport.scrollLeft += x;
		else              $viewport.scrollLeft += $viewport.clientWidth  * x;
		if( y % 1 === 0 ) $viewport.scrollTop  += y;
		else              $viewport.scrollTop  += $viewport.clientHeight * y;
	}

	if( !repeat && !jump ){ // there's no need to repeat when jumping
		TID = setTimeout( function(){
			IID = setInterval( function(){
				scrollViewport( $viewport, x, y, jump, true );
			}, REPEAT );
		}, DELAY - REPEAT );
	}
}

// while it's not necessary to check if a class exists before adding or removing it (since a class will only be added once anyway)
// it seems to have a performance boost (at least in firefox with dev tools open)
// apparently it re-adds a class if it's there instead of doing nothing, which doesn't seem to be so smart
function addClass( $elem, className ){
	if( !$elem.classList.contains( className ) ){
		$elem.classList.add( className );
	}
}
function remClass( $elem, className ){
	if( $elem.classList.contains( className ) ){
		$elem.classList.remove( className );
	}
}



// contains all the containers to watch over so we don't have to read the entire DOM every time update is called just to find our elements
var $ELEMS = [];

function add( $elem ){
	if( !INIT ) return; // do nothing if scrollbarjs hasn't been initialized yet; that is to prevent weird behavior caused by missing CSS rules

	var $viewport;

	if( $elem.tagName === 'BODY' ){
		$viewport = document.createElement('div');

	} else if( $elem.tagName === 'TEXTAREA' ){
		// TODO: make textareas work
		$viewport = document.createElement('div');

	} else {
		$viewport = document.createElement( $elem.tagName );
	}

	$elem.classList.add( PREFIX );

	$viewport.className = PREFIX + '-viewport';
	$viewport.dataset.scrollbarjs = ' '; // a space so I don't have to do additional checks in the update function
	$viewport.innerHTML = $elem.innerHTML;

	$elem.innerHTML = '';
	$elem.appendChild( $viewport );

	// create scrollbars; naming similar to https://webkit.org/blog/363/styling-scrollbars/
	// vertical
	var $ver = document.createElement('aside');
	$ver.className = PREFIX + '-scrollbar ' + PREFIX + '-ver';

	var $up = document.createElement('div');
	$up.className = PREFIX + '-button ' + PREFIX + '-up';
	$up.addEventListener( 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_UP ) } );

	var $trackVer = document.createElement('div');
	$trackVer.className = PREFIX + '-track ' + PREFIX + '-track-ver';

	var $trackUp = document.createElement('div');
	$trackUp.className = PREFIX + '-track-piece ' + PREFIX + '-track-up'
	$trackUp.addEventListener( 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_UP ) } );

	var $thumbVer = document.createElement('div');
	$thumbVer.className = PREFIX + '-thumb ' + PREFIX + '-thumb-ver';
	$thumbVer.addEventListener( 'mousedown', function( e ){ clickThumb( e, $viewport, DRAG_VER ) } );

	var $trackDown = document.createElement('div');
	$trackDown.className = PREFIX + '-track-piece ' + PREFIX + '-track-down'
	$trackDown.addEventListener( 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_DOWN ) } );

	$trackVer.appendChild( $trackUp   );
	$trackVer.appendChild( $thumbVer  );
	$trackVer.appendChild( $trackDown );

	var $down = document.createElement('div');
	$down.className = PREFIX + '-button ' + PREFIX + '-down';
	$down.addEventListener( 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_DOWN ) } );

	$ver.appendChild( $up       );
	$ver.appendChild( $trackVer );
	$ver.appendChild( $down     );

	// horizontal
	var $hor = document.createElement('aside');
	$hor.className = PREFIX + '-scrollbar ' + PREFIX + '-hor';

	var $left = document.createElement('div');
	$left.className = PREFIX + '-button ' + PREFIX + '-left';
	$left.addEventListener( 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_LEFT ) } );

	var $trackHor = document.createElement('div');
	$trackHor.className = PREFIX + '-track ' + PREFIX + '-track-hor';

	var $trackLeft = document.createElement('div');
	$trackLeft.className = PREFIX + '-track-piece ' + PREFIX + '-track-left'
	$trackLeft.addEventListener( 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_LEFT ) } );

	var $thumbHor = document.createElement('div');
	$thumbHor.className = PREFIX + '-thumb ' + PREFIX + '-thumb-hor';
	$thumbHor.addEventListener( 'mousedown', function( e ){ clickThumb( e, $viewport, DRAG_HOR ) } );

	var $trackRight = document.createElement('div');
	$trackRight.className = PREFIX + '-track-piece ' + PREFIX + '-track-right'
	$trackRight.addEventListener( 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_RIGHT ) } );

	$trackHor.appendChild( $trackLeft  );
	$trackHor.appendChild( $thumbHor   );
	$trackHor.appendChild( $trackRight );

	var $right = document.createElement('div');
	$right.className = PREFIX + '-button ' + PREFIX + '-right';
	$right.addEventListener( 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_RIGHT ) } );

	$hor.appendChild( $left     );
	$hor.appendChild( $trackHor );
	$hor.appendChild( $right    );

	$elem.appendChild( $ver );
	$elem.appendChild( $hor );

	// corner
	var $corner = document.createElement('aside');
	$corner.className = PREFIX + '-corner';

	var resize = getComputedStyle( $elem )['resize'];
	if( resize === 'both' || resize === 'horizontal' || resize === 'vertical' ){
		$elem.classList.add( PREFIX + '-resizable' );

		var direction;
		var directionClass;
		switch( resize ){
			case 'vertical':   direction = DRAG_VER;  directionClass = 'ver';  break;
			case 'horizontal': direction = DRAG_HOR;  directionClass = 'hor';  break;
			case 'both':       direction = DRAG_BOTH; directionClass = 'both'; break;
		}

		$corner.classList.add( PREFIX + '-resize-' + directionClass );
		$corner.addEventListener( 'mousedown', function( e ){ clickResize( e, $elem, direction ) } );
	}

	$elem.appendChild( $corner );



	$ELEMS.push( $elem );
}



function updateViewport( $elem, $viewport ){
	// height:100% doesn't work on elements whose parents don't have an explicit value set
	// this is a hacky way to achieve this anyways
	// Firefox won't remember the scroll position after a reload, but I think that's bearable ;)
	if( $elem.clientHeight < $viewport.scrollHeight ){ // check if the element can grow

		var y = $viewport.scrollTop; // keep scrolling distance
		$viewport.style.height = ''; // try to be as big as the content

		if( $elem.clientHeight < $viewport.scrollHeight ) // if that doesn't work, shrink to fit
			$viewport.style.height = $elem.clientHeight + NATIVE_HEIGHT + 1 + 'px'; // +1 so the element will expand once it can, trying this procedure again
		else // if it did work, remove that spare 1px line at the bottom; this will prevent flickering when resizing
			$viewport.style.height = $elem.clientHeight + NATIVE_HEIGHT + 'px';

		$viewport.scrollTop = y;

	} else { // match the element
		$viewport.style.height = $elem.clientHeight + NATIVE_HEIGHT + 'px';
	}
}

function updateScrollbars( $elem, $viewport ){
	// in % from 0 to 1, how much of the viewport is visible
	var thumbHeight = $viewport.clientHeight / $viewport.scrollHeight;
	var thumbWidth  = $viewport.clientWidth  / $viewport.scrollWidth;

	// which scrollbars are active
	if(      thumbHeight === 1 && thumbWidth === 1 ) switchScrollClass( $elem, CLASS_SCROLL_NONE );
	else if( thumbHeight !== 1 && thumbWidth === 1 ) switchScrollClass( $elem, CLASS_SCROLL_VER  );
	else if( thumbHeight === 1 && thumbWidth !== 1 ) switchScrollClass( $elem, CLASS_SCROLL_HOR  );
	else if( thumbHeight !== 1 && thumbWidth !== 1 ) switchScrollClass( $elem, CLASS_SCROLL_BOTH );

	// apply extra classes to indicate if a button will do something
	var $buttonUp    = $elem.children[1].children[0];
	var $buttonDown  = $elem.children[1].children[2];
	var $buttonLeft  = $elem.children[2].children[0];
	var $buttonRight = $elem.children[2].children[2];

	if( $viewport.scrollTop  === 0 ) addClass( $buttonUp,   PREFIX + '-button-inactive' );
	else                             remClass( $buttonUp,   PREFIX + '-button-inactive' );
	if( $viewport.scrollLeft === 0 ) addClass( $buttonLeft, PREFIX + '-button-inactive' );
	else                             remClass( $buttonLeft, PREFIX + '-button-inactive' );

	if( ( $viewport.scrollTop  + $viewport.clientHeight ) === $viewport.scrollHeight ) addClass( $buttonDown,  PREFIX + '-button-inactive' );
	else                                                                               remClass( $buttonDown,  PREFIX + '-button-inactive' );
	if( ( $viewport.scrollLeft + $viewport.clientWidth  ) === $viewport.scrollWidth  ) addClass( $buttonRight, PREFIX + '-button-inactive' );
	else                                                                               remClass( $buttonRight, PREFIX + '-button-inactive' );



	// calculate thumb size
	var $trackVer  = $elem.children[1].children[1];
	var $trackUp   = $trackVer.children[0];
	var $thumbVer  = $trackVer.children[1];
	var $trackDown = $trackVer.children[2];

	var $trackHor   = $elem.children[2].children[1];
	var $trackLeft  = $trackHor.children[0];
	var $thumbHor   = $trackHor.children[1];
	var $trackRight = $trackHor.children[2];

	var trackHeight = $trackVer.clientHeight;
	var trackWidth  = $trackHor.clientWidth;

	// height/width of track-up/track-left
	var trackUpHeight  = Math.floor( trackHeight * ( $viewport.scrollTop  / $viewport.scrollHeight ) );
	var trackLeftWidth = Math.floor( trackWidth  * ( $viewport.scrollLeft / $viewport.scrollWidth ) );
	$trackUp.style.height  = trackUpHeight  + 'px';
	$trackLeft.style.width = trackLeftWidth + 'px';

	// height/width of the thumb
	var thumbHeight = Math.ceil( trackHeight * thumbHeight );
	var thumbWidth  = Math.ceil( trackWidth  * thumbWidth  );
	$thumbVer.style.height = thumbHeight + 'px';
	$thumbHor.style.width  = thumbWidth  + 'px';

	// height/width of track-down/track-right
	var trackDownHeight = trackHeight - trackUpHeight  - thumbHeight;
	var trackRightWidth = trackWidth  - trackLeftWidth - thumbWidth;
	$trackDown.style.height = trackDownHeight + 'px';
	$trackRight.style.width = trackRightWidth + 'px';
}

function update( $elem ){
	var $viewport = $elem.children[0];

	var viewport  = $elem.clientHeight     + ',' + $elem.clientWidth     + '-' +
	                //$viewport.offsetHeight + ',' + $viewport.offsetWidth + '-' +
	                $viewport.scrollHeight + ',' + $viewport.scrollWidth;
	var scrollbar = $viewport.scrollTop    + ',' + $viewport.scrollLeft;

	var dataOld = $viewport.dataset.scrollbarjs.split(' ');
	if( dataOld[0] !== viewport ){ // element or content size changed
		updateViewport( $elem, $viewport );
		updateScrollbars( $elem, $viewport );

	} else if( dataOld[1] !== scrollbar ) { // only scrollbar position changed
		updateScrollbars( $elem, $viewport );

	} else { // nothing changed, so nothing to do
	 return;
	}

	$viewport.dataset.scrollbarjs = viewport + ' ' + scrollbar;
}

// keep it updated
requestAnimationFrame( function watch(){
	$ELEMS.forEach( update );
	requestAnimationFrame( watch );
} );



return {
	add: add,
	init: init
}

}());
