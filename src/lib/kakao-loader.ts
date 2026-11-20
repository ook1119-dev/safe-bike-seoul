"use client";

let loading: Promise<typeof kakao> | null = null;

export function loadKakaoMaps(appKey: string) {
  if (loading) return loading;

  loading = new Promise<typeof kakao>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), 15_000);
    const done = () => {
      window.clearTimeout(timer);
      resolve(window.kakao!);
    };

    if (window.kakao?.maps) {
      window.kakao.maps.load(done);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao?.maps) {
        window.clearTimeout(timer);
        reject(new Error("sdk"));
        return;
      }
      window.kakao.maps.load(done);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("script"));
    };
    document.head.appendChild(script);
  });

  // 실패했으면 다음에 다시 시도할 수 있게
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
