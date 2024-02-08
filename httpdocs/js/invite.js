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
  console.log("coucou");
  const fingerprint = findGetParameter('fingerprint');
  fetch(`https://notary.directdemocracy.vote/api/publication.php?fingerprint=${fingerprint}`)
    .then(response => response.json())
    .then(answer => {
      if (answer.error) {
        console.error(answer.error);
        return;
      }
      console.log(answer);
    }
}
