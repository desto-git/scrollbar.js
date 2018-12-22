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
*/

// don't forget to change your css accordingly
var configPrefix = 'scrollbarjs';

// distance to scroll when clicking
// int = px, float = %
// note however that 1.0 === 1, so it will be identified as an int. to say 100%, use something very close to it, e.g. 0.9999
var configButtonDistance = 60; // on a button
var configTrackDistance = 0.9; // somewhere on the track

var configDelay = 200; // wait x milliseconds before repeating the action
var configRepeat = 50; // repeat every x milliseconds



// put some global things into local scope, so uglify can better compress the source
//
var doc = document;
var $head = doc.head;
var $body = doc.body;
var createElement = doc.createElement.bind( doc );

function appendChild( $parent, $child ){ $parent.appendChild( $child ); }
function addEventListener( $target, event, callback ){ $target.addEventListener( event, callback ); }

function addClass( $elem, className ){ $elem.classList.add   ( className ); }
function remClass( $elem, className ){ $elem.classList.remove( className ); }



// getPrefixed( 'viewport', 'fit-parent' ) => "CFG_PREFIX-viewport CFG_PREFIX-fit-parent"
function getPrefixed( /* ... */ ){
	var className = '';

	for( var i = 0; i < arguments.length; ++i )
		className += ' ' + configPrefix + '-' + arguments[i];

	return className.trim(); // remove leading whitespace
}



var INIT = false;
var INIT_DATA = {};
function init( config ){
	if( INIT ){
		console.warn('scrollbarjs cannot be initiated more than once');
		return INIT_DATA;
	}

	if( config !== undefined ){
		if( config.prefix         ) configPrefix          = config.prefix;
		if( config.buttonDistance ) configButtonDistance = config.buttonDistance;
		if( config.trackDistance  ) configTrackDistance  = config.trackDistance;
		if( config.delay          ) configDelay           = config.delay;
		if( config.repeat         ) configRepeat          = config.repeat;
	}

	// inject required CSS into the page
	var $style = createElement('style');
	$style.innerHTML =
		'body.' + configPrefix + '{' +
			'height:100vh;' + // min-height would gradually grow, max-height wouldn't show a scrollbar
		'}' +

		'.' + getPrefixed('drag') + '{' + // don't trigger selection when dragging the thumbs - https://stackoverflow.com/a/4407335
			'-webkit-touch-callout:none;' +
			  '-webkit-user-select:none;' +
			   '-khtml-user-select:none;' +
			     '-moz-user-select:none;' +
			      '-ms-user-select:none;' +
			          'user-select:none;' +
		'}' +

		'.' + configPrefix + '{' +
			'overflow:hidden;' +
			'position:relative;' +
		'}' +

		'.' + getPrefixed('viewport') + '{' +
			'overflow:scroll;' +
			'margin-right:'  + -NATIVE_WIDTH  + 'px;' +
			'margin-bottom:' + -NATIVE_HEIGHT + 'px;' +
		'}' +


		'.' + getPrefixed('resizable') + '{' + // resizing is done in js
			'resize:none!important;' +
		'}';
	appendChild( $head, $style );

	INIT = true;
	INIT_DATA = {
		nativeHeight          : NATIVE_HEIGHT,
		nativeWidth           : NATIVE_WIDTH,
		nativeDisplaces       : ( NATIVE_HEIGHT > 0 || NATIVE_WIDTH > 0 ),
		supportsWebkitStyling : SUPPORTS_WEBKIT_STYLING,
		supportsMsHiding      : SUPPORTS_MS_HIDING,
	};

	return INIT_DATA;
}



// below this point is calculated stuff

// to get the native width and height of a scrollbar, we create an element with overflow:scroll
// it will be removed right afterwards when we have the details we want
var NATIVE_WIDTH  = 0;
var NATIVE_HEIGHT = 0;

// additionally, we check for some ways to hide the scrollbar natively (without killing scrolling like overflow:hidden does)
// in these cases, putting a wrapper around to hide the scrollbars would not be required
var SUPPORTS_WEBKIT_STYLING = false; // do ::-webkit-scrollbar pseudo classes work? note that these don't seem to work on the body in mobile view
var SUPPORTS_MS_HIDING = false; // does -ms-overflow-style work?

(function(){ // scoping to pretent it didn't happen

	// add styles required for this to work
	var $style = createElement('style');
	appendChild( $head, $style );
	$style.innerHTML = '#scrollbarjs-sb-size{' +
		'width:100%;'        + // it needs to be bigger than the scrollbar
		'height:100%;'       +
		'overflow:scroll;'   + // show scrollbars
		'position:absolute;' + // don't break the flow of the document in the process
		'top:100%;'          + // hide
	'}';

	// get dimensions of native scrollbars
	var $size = createElement('div');
	$size.id = 'scrollbarjs-sb-size';
	appendChild( $body, $size );

	NATIVE_WIDTH  = $size.offsetWidth  - $size.clientWidth;
	NATIVE_HEIGHT = $size.offsetHeight - $size.clientHeight;

	// check if native tricks are available to hide scrollbars
	$style.innerHTML +=
		'#scrollbarjs-sb-size::-webkit-scrollbar{display:none}' + // webkit
		'#scrollbarjs-sb-size{-ms-overflow-style:none}'; // ie and edge

	try{
		if( getComputedStyle( $size, '::-webkit-scrollbar' )['display'] === 'none' ){
			SUPPORTS_WEBKIT_STYLING = true;
		}
	}catch(e){
		// Firefox throws when checking an unknown pseudo element (NS_ERROR_NOT_AVAILABLE)
	}

	if( getComputedStyle( $size )['-ms-overflow-style'] === 'none' ){
		SUPPORTS_MS_HIDING = true;
	}

	$style.parentElement.removeChild( $style );
	$size .parentElement.removeChild( $size  );
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
	remClass( $body, getPrefixed('drag') );
	if( $DRAG_TARGET !== undefined ){
		remClass( $DRAG_TARGET.parentElement, getPrefixed('active') );
		$DRAG_TARGET = undefined;
	}
}
addEventListener( $body, 'mouseup', reset );
addEventListener( $body, 'mouseenter', function( e ){
	// leaving browser window and going back in, check if left mouse button is "still" pressed
	if( ( e.buttons & 1 ) !== 1 ) reset();
} );

var LAST_X, LAST_Y; // last x y offset
var DRAG_MODE_SCROLL = 0;
var DRAG_MODE_RESIZE = 1;
addEventListener( $body, 'mousemove', function( e ){
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
		// chrome's way makes more sense (resize by twice the amount when centered so it keeps following the cursor properly)
		// but firefox' is easier to implement, as I don't need to check for all the ways the content could be centered (margin: 0 auto, flexbox, text-align,..?)
		// and IE11 doesn't understand resize in the first place, so only benefits there!
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

	switch( direction ){
		case BUTTON_UP:    scrollViewport( $viewport, 0, -configButtonDistance    ); break;
		case BUTTON_RIGHT: scrollViewport( $viewport,     configButtonDistance, 0 ); break;
		case BUTTON_DOWN:  scrollViewport( $viewport, 0,  configButtonDistance    ); break;
		case BUTTON_LEFT:  scrollViewport( $viewport,    -configButtonDistance, 0 ); break;
	}
}

var TRACK_UP    = 0;
var TRACK_RIGHT = 1;
var TRACK_DOWN  = 2;
var TRACK_LEFT  = 3;
function clickTrack( event, $viewport, direction ){
	if( event.button !== 0 ) return;

	switch( direction ){
		case TRACK_UP:    scrollViewport( $viewport, 0, -configTrackDistance ); break;
		case TRACK_RIGHT: scrollViewport( $viewport, configTrackDistance, 0  ); break;
		case TRACK_DOWN:  scrollViewport( $viewport, 0, configTrackDistance  ); break;
		case TRACK_LEFT:  scrollViewport( $viewport, -configTrackDistance, 0 ); break;
	}
}

var DRAG_VER = 0;
var DRAG_HOR = 1;
function clickThumb( event, $viewport, direction ){
	if( event.button !== 0 ) return;
	addClass( $body, getPrefixed('drag') );
	addClass( $viewport.parentElement, getPrefixed('active') );

	var $target = event.target.parentElement;
	DRAG_MODE = DRAG_MODE_SCROLL;
	DRAG_AXIS = direction;
	$DRAG_TARGET = $viewport;

	if( direction === DRAG_VER ){
		VIEWPORT_SCROLLPOS = $viewport.scrollTop;
		DRAG_DISTANCE = $viewport.scrollHeight / $target.clientHeight;
	} else {
		VIEWPORT_SCROLLPOS = $viewport.scrollLeft;
		DRAG_DISTANCE = $viewport.scrollWidth / $target.clientWidth;
	}
}

var DRAG_BOTH = 2;
function clickResize( event, $elem, direction ){
	if( event.button !== 0 ) return;
	addClass( $body, getPrefixed('drag') );

	DRAG_MODE = DRAG_MODE_RESIZE;
	DRAG_AXIS = direction;
	$DRAG_TARGET = $elem;
}

// helper functions
var CLASS_SCROLL_NONE = getPrefixed('scroll-none');
var CLASS_SCROLL_VER  = getPrefixed('scroll-ver' );
var CLASS_SCROLL_HOR  = getPrefixed('scroll-hor' );
var CLASS_SCROLL_BOTH = getPrefixed('scroll-both');
function switchScrollClass( $elem, className ){
	if( $elem.classList.contains( className ) )
		return;

	remClass( $elem, CLASS_SCROLL_NONE );
	remClass( $elem, CLASS_SCROLL_VER  );
	remClass( $elem, CLASS_SCROLL_HOR  );
	remClass( $elem, CLASS_SCROLL_BOTH );
	addClass( $elem, className );
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
			}, configRepeat );
		}, configDelay - configRepeat );
	}
}



// contains all the containers to watch over so we don't have to read the entire DOM every time update is called just to find our elements
var $ELEMS = [];

function add( $elem ){
	if( !INIT ) return; // do nothing if scrollbarjs hasn't been initialized yet; that is to prevent weird behavior caused by missing CSS rules

	var $viewport;

	if( $elem.tagName === 'BODY' ){
		$viewport = createElement('div');

	} else if( $elem.tagName === 'TEXTAREA' ){
		// TODO: make textareas work
		$viewport = createElement('div');

	} else {
		$viewport = createElement( $elem.tagName );
	}

	addClass( $elem, configPrefix );

	$viewport.className = getPrefixed('viewport');
	$viewport.dataset.scrollbarjs = ' '; // a space so I don't have to do additional checks in the update function
	$viewport.innerHTML = $elem.innerHTML;

	$elem.innerHTML = '';
	appendChild( $elem, $viewport );

	// create scrollbars; naming similar to https://webkit.org/blog/363/styling-scrollbars/
	// vertical
	var $ver = createElement('aside');
	$ver.className = getPrefixed('scrollbar', 'ver');

	var $up = createElement('div');
	$up.className = getPrefixed('button', 'up');
	addEventListener( $up, 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_UP ) } );

	var $trackVer = createElement('div');
	$trackVer.className = getPrefixed('track', 'track-ver');

	var $trackUp = createElement('div');
	$trackUp.className = getPrefixed('track-piece', 'track-up');
	addEventListener( $trackUp, 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_UP ) } );

	var $thumbVer = createElement('div');
	$thumbVer.className = getPrefixed('thumb', 'thumb-ver');
	addEventListener( $thumbVer, 'mousedown', function( e ){ clickThumb( e, $viewport, DRAG_VER ) } );

	var $trackDown = createElement('div');
	$trackDown.className = getPrefixed('track-piece', 'track-down');
	addEventListener( $trackDown, 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_DOWN ) } );

	appendChild( $trackVer, $trackUp   );
	appendChild( $trackVer, $thumbVer  );
	appendChild( $trackVer, $trackDown );

	var $down = createElement('div');
	$down.className = getPrefixed('button', 'down');
	addEventListener( $down, 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_DOWN ) } );

	appendChild( $ver, $up       );
	appendChild( $ver, $trackVer );
	appendChild( $ver, $down     );

	// horizontal
	var $hor = createElement('aside');
	$hor.className = getPrefixed('scrollbar', 'hor');

	var $left = createElement('div');
	$left.className = getPrefixed('button', 'left');
	addEventListener( $left, 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_LEFT ) } );

	var $trackHor = createElement('div');
	$trackHor.className = getPrefixed('track', 'track-hor');

	var $trackLeft = createElement('div');
	$trackLeft.className = getPrefixed('track-piece', 'track-left');
	addEventListener( $trackLeft, 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_LEFT ) } );

	var $thumbHor = createElement('div');
	$thumbHor.className = getPrefixed('thumb', 'thumb-hor');
	addEventListener( $thumbHor, 'mousedown', function( e ){ clickThumb( e, $viewport, DRAG_HOR ) } );

	var $trackRight = createElement('div');
	$trackRight.className = getPrefixed('track-piece', 'track-right');
	addEventListener( $trackRight, 'mousedown', function( e ){ clickTrack( e, $viewport, TRACK_RIGHT ) } );

	appendChild( $trackHor, $trackLeft  );
	appendChild( $trackHor, $thumbHor   );
	appendChild( $trackHor, $trackRight );

	var $right = createElement('div');
	$right.className = getPrefixed('button', 'right');
	addEventListener( $right, 'mousedown', function( e ){ clickButton( e, $viewport, BUTTON_RIGHT ) } );

	appendChild( $hor, $left     );
	appendChild( $hor, $trackHor );
	appendChild( $hor, $right    );

	appendChild( $elem, $ver );
	appendChild( $elem, $hor );

	// corner
	var $corner = createElement('aside');
	$corner.className = getPrefixed('corner');

	var resize = getComputedStyle( $elem )['resize'];
	if( resize === 'both' || resize === 'horizontal' || resize === 'vertical' ){
		addClass( $elem, getPrefixed('resizable') );

		var direction;
		var directionClass;
		switch( resize ){
			case 'vertical':   direction = DRAG_VER;  directionClass = 'ver';  break;
			case 'horizontal': direction = DRAG_HOR;  directionClass = 'hor';  break;
			case 'both':       direction = DRAG_BOTH; directionClass = 'both'; break;
		}

		addClass( $corner, getPrefixed('resize-' + directionClass) );
		addEventListener( $corner, 'mousedown', function( e ){ clickResize( e, $elem, direction ) } );
	}

	appendChild( $elem, $corner );



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
	     if( thumbHeight === 1 && thumbWidth === 1 ) switchScrollClass( $elem, CLASS_SCROLL_NONE );
	else if( thumbHeight !== 1 && thumbWidth === 1 ) switchScrollClass( $elem, CLASS_SCROLL_VER  );
	else if( thumbHeight === 1 && thumbWidth !== 1 ) switchScrollClass( $elem, CLASS_SCROLL_HOR  );
	else if( thumbHeight !== 1 && thumbWidth !== 1 ) switchScrollClass( $elem, CLASS_SCROLL_BOTH );

	// apply extra classes to indicate if a button will do something
	var $buttonUp    = $elem.children[1].children[0];
	var $buttonDown  = $elem.children[1].children[2];
	var $buttonLeft  = $elem.children[2].children[0];
	var $buttonRight = $elem.children[2].children[2];

	if( $viewport.scrollTop  === 0 ) addClass( $buttonUp,   getPrefixed('button-inactive') );
	else                             remClass( $buttonUp,   getPrefixed('button-inactive') );
	if( $viewport.scrollLeft === 0 ) addClass( $buttonLeft, getPrefixed('button-inactive') );
	else                             remClass( $buttonLeft, getPrefixed('button-inactive') );

	if( ( $viewport.scrollTop  + $viewport.clientHeight ) === $viewport.scrollHeight ) addClass( $buttonDown,  getPrefixed('button-inactive') );
	else                                                                               remClass( $buttonDown,  getPrefixed('button-inactive') );
	if( ( $viewport.scrollLeft + $viewport.clientWidth  ) === $viewport.scrollWidth  ) addClass( $buttonRight, getPrefixed('button-inactive') );
	else                                                                               remClass( $buttonRight, getPrefixed('button-inactive') );

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
