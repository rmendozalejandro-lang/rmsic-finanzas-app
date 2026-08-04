function retryConnection() {
  window.location.reload()
}

document.querySelector('#retry-button').addEventListener('click', retryConnection)
window.addEventListener('online', retryConnection)
