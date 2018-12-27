// this is executed after elements have been added to scrollbarjs
// doing so breaks the reference as the elements will be transfered with a plain innerHTML assignment

// add paragraph button
var pTarget = document.getElementById('p-target');
document.getElementById('add-p').addEventListener('click', function(){
	addP( pTarget, 1 );
});
document.getElementById('clr-p').addEventListener('click', function(){
	pTarget.innerHTML = '';
});

// theme selection
var $themeButtons = document.querySelectorAll('#theme-selector > button');
for( var i = 0; i < $themeButtons.length; ++i ){
	var $button = $themeButtons[i];
	$button.addEventListener('click', function(){
		selectTheme( this.dataset.theme );
	});
}