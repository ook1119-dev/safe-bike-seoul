# Safe Bike Seoul

따릉이 대여소, 카카오 자전거 경로, 자전거 사고다발지역, 기상청 단기예보를 한 화면에서 보는 웹앱입니다.
(생성형AI 수업 Week12 실습 - 여러 API 결합하기)

배포 주소: https://safe-bike-seoul-psi.vercel.app

## 기능

- 출발지/목적지 검색 (카카오 로컬 API), 현재 위치 사용
- 출발지 주변 따릉이 대여소와 대여 가능 자전거 수 (거리순, 반경 필터)
- 선택한 대여소 → 목적지 자전거 경로: 자전거도로 우선 / 최단 경로
- 경로 주변 과거 사고다발지역 수 비교 (100m ~ 1km)
- 출발지 기온, 강수확률 (발표시각 / 예보시각 구분)
- 데이터별 출처와 조회시각 표

경로 API 호출이 실패하면 임의로 경로를 그리지 않고 실패 이유만 보여줍니다.
사고다발지역은 과거 통계라서 "안전한 경로"를 판단하는 용도는 아닙니다.

## 사용한 API

| 데이터 | API | 키 |
| --- | --- | --- |
| 따릉이 실시간 대여정보 | 서울 열린데이터광장 `bikeList` | `SEOUL_API_KEY` |
| 자전거 사고다발지역 | 공공데이터포털 `getRestFrequentzoneBicycle` | `DATA_GO_KR_API_KEY` |
| 단기예보 | 공공데이터포털 `getVilageFcst` | `DATA_GO_KR_API_KEY` |
| 지도 | 카카오맵 JavaScript SDK | `NEXT_PUBLIC_KAKAO_JS_KEY` |
| 장소 검색, 자전거 경로 | 카카오 REST API | `KAKAO_REST_API_KEY` |

## 실행

```bash
npm install
cp .env.example .env   # 키 입력
npm run dev
```

http://localhost:3000 접속. 서울시 API는 http만 지원해서 `SEOUL_ALLOW_HTTP=true` 가 있어야 따릉이 정보가 나옵니다.

`/api/status` 에 들어가면 환경변수가 들어갔는지 true/false로 확인할 수 있습니다. (키 값은 안 보여줌)

## 구조

```
src/app/api/       서버 API (stations, places, directions, hotspots, weather, status)
src/lib/           외부 API 호출, 좌표 계산 (기상청 격자 변환, 경로-지점 거리)
src/components/    화면 컴포넌트
```

인증키는 서버 API 라우트에서만 쓰고 브라우저로 보내지 않습니다. 지도용 JavaScript 키만 `NEXT_PUBLIC_` 으로 공개됩니다.
