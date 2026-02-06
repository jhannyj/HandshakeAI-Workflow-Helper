console.log("SCRIPT IS ALIVE!")

// Listen for URL changes without a full page reload
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log("URL changed (Redirected)! Current URL:", url);
        // Call your logic here
    }
}).observe(document, {subtree: true, childList: true});