// 배포 후 환경변수가 제대로 들어갔는지 확인용 (키 값 자체는 내보내지 않음)
export const dynamic = "force-dynamic";

export async function GET() {
  const has = (name: string) => Boolean(process.env[name]?.trim());

  return Response.json({
    SEOUL_API_KEY: has("SEOUL_API_KEY"),
    DATA_GO_KR_API_KEY: has("DATA_GO_KR_API_KEY"),
    KAKAO_REST_API_KEY: has("KAKAO_REST_API_KEY"),
    NEXT_PUBLIC_KAKAO_JS_KEY: has("NEXT_PUBLIC_KAKAO_JS_KEY"),
    SEOUL_ALLOW_HTTP: process.env.SEOUL_ALLOW_HTTP?.trim().toLowerCase() === "true",
  });
}
