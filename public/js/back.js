// back.js - global safe back button

function toAbsolute(pathLike) {
  const origin = location.origin;
  if (!pathLike) pathLike = '/';
  return new URL(pathLike, origin).href;
}

function safeBackTo(fallback = '/') {
  try {
    const origin = location.origin;
    const ref = document.referrer || '';
    if (ref.startsWith(origin)) {
      history.back();
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          location.replace(toAbsolute(fallback));
        }
      }, 400);
    } else {
      location.replace(toAbsolute(fallback));
    }
  } catch {
    location.replace(toAbsolute(fallback));
  }
}

