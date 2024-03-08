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
      const invite = document.getElementById('invite');
      translator.translateElement(invite, 'invite', [answer.givenNames, answer.familyName, fingerprint]);
    });
};
