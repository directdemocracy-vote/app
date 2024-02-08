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
  const fingerprint = findGetParameter('fingerprint');
  fetch(`https://notary.directdemocracy.vote/api/publication.php?fingerprint=${fingerprint}`)
    .then(response => response.json())
    .then(answer => {
      if (answer.error) {
        console.error(answer.error);
        return;
      }
      document.getElementById('introduction').innerHTML = `<img src="${answer.picture}" style="float:left;margin-right:16px;width:100px">` +
        `${answer.givenNames} ${answer.familyName} would like to be endorsed by you.<br>` +
        'If you agree, install the app on your phone and click the <b>Review</b> link on this ' +
        `<a target="_blank" href="https://notary.directdemocracy.vote/citizen.html?fingerprint=${fingerprint}">citizen page</a>.`;
    });
};
