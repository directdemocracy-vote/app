function findGetParameter(parameterName) {
  let result;
  location.search.substr(1).split('&').forEach(function(item) {
    const tmp = item.split('=');
    if (tmp[0] === parameterName)
      result = decodeURIComponent(tmp[1]);
  });
  return result;
}

window.onload = function() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  if (/android/i.test(userAgent))
    document.getElementById('iOS').style.display = 'none';
  else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream)
    document.getElementById('Android').style.display = 'none';
  
  const fingerprint = findGetParameter('fingerprint');
  fetch(`https://notary.directdemocracy.vote/api/publication.php?fingerprint=${fingerprint}`)
    .then(response => response.json())
    .then(answer => {
      if (answer.error) {
        console.error(answer.error);
        return;
      }
      document.getElementById('picture').src = answer.picture;
      document.getElementById('introduction').innerHTML =
        `${answer.givenNames} ${answer.familyName} would like to be endorsed by you.<br>` +
        'If you agree, install the app on your phone and click the <b>Review</b> link on this ' +
        `<a target="_blank" href="https://notary.directdemocracy.vote/citizen.html?fingerprint=${fingerprint}">citizen page</a>.`;
    });
};
