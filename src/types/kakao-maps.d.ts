// 카카오맵 JS SDK에서 실제로 쓰는 부분만 타입 선언

declare namespace kakao.maps {
  function load(callback: () => void): void;

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
    isEmpty(): boolean;
  }

  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level?: number });
    setCenter(latlng: LatLng): void;
    panTo(latlng: LatLng): void;
    setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
    getLevel(): number;
    setLevel(level: number, options?: { animate?: boolean }): void;
    relayout(): void;
    addControl(control: ZoomControl, position: ControlPosition): void;
  }

  class ZoomControl {}

  enum ControlPosition {
    TOP,
    TOPLEFT,
    TOPRIGHT,
    LEFT,
    RIGHT,
    BOTTOMLEFT,
    BOTTOM,
    BOTTOMRIGHT,
  }

  interface Overlay {
    setMap(map: Map | null): void;
  }

  class CustomOverlay implements Overlay {
    constructor(options: {
      position: LatLng;
      content: HTMLElement | string;
      map?: Map;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      clickable?: boolean;
    });
    setMap(map: Map | null): void;
    setZIndex(zIndex: number): void;
  }

  type ShapeOptions = {
    map?: Map;
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: "solid" | "shortdash" | "shortdot" | "dash" | "dot";
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  };

  class Polyline implements Overlay {
    constructor(options: ShapeOptions & { path: LatLng[] });
    setMap(map: Map | null): void;
  }

  class Polygon implements Overlay {
    constructor(options: ShapeOptions & { path: LatLng[] });
    setMap(map: Map | null): void;
  }

  class Circle implements Overlay {
    constructor(options: ShapeOptions & { center: LatLng; radius: number });
    setMap(map: Map | null): void;
  }
}

interface Window {
  kakao?: typeof kakao;
}
