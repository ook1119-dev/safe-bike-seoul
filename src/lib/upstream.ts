// 외부 API 호출 공통 처리

export class UpstreamError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status = 502, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 10_000) {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new UpstreamError("외부 API 응답 시간이 초과되었습니다.", 504);
    }
    throw new UpstreamError("외부 API 서버에 연결하지 못했습니다.", 502, String(err));
  }
  return { status: res.status, ok: res.ok, text: await res.text() };
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new UpstreamError(`${name} 환경변수가 설정되지 않았습니다.`, 500);
  }
  return value;
}

// 공공데이터포털은 Encoding/Decoding 키 두 개를 주는데, 어느 쪽을 넣어도 동작하게 한다.
// (URLSearchParams가 다시 인코딩하므로 디코딩된 값이 필요함)
export function dataGoKrKey() {
  const key = requireEnv("DATA_GO_KR_API_KEY");
  if (!key.includes("%")) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

const DATA_GO_KR_ERRORS: Record<string, string> = {
  SERVICE_KEY_IS_NOT_REGISTERED_ERROR:
    "등록되지 않은 인증키입니다. 활용신청 승인 여부와 키 값을 확인하세요. (발급 직후에는 반영까지 시간이 걸릴 수 있음)",
  SERVICE_ACCESS_DENIED_ERROR: "이 API에 대한 활용신청이 되어 있지 않습니다.",
  LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR: "일일 호출 한도를 초과했습니다.",
  DEADLINE_HAS_EXPIRED_ERROR: "활용 기간이 만료된 인증키입니다.",
  UNREGISTERED_IP_ERROR: "등록되지 않은 IP에서 호출했습니다.",
};

// 공공데이터포털 게이트웨이 오류는 XML, 평문, {"OpenAPI_ServiceResponse": ...} JSON 등 여러 형태로 온다
export function dataGoKrError(status: number, text: string) {
  const codes = [
    ...text.matchAll(/<(?:returnAuthMsg|errMsg)>([^<]+)</g),
    ...text.matchAll(/"(?:returnAuthMsg|errMsg)"\s*:\s*"([^"]+)"/g),
  ].map((m) => m[1].trim());

  const known = codes.find((c) => DATA_GO_KR_ERRORS[c]);
  if (known) {
    return new UpstreamError(DATA_GO_KR_ERRORS[known], 502, known);
  }
  const authMsg = codes[0];
  if (status === 401 || /unauthorized/i.test(text)) {
    return new UpstreamError("공공데이터포털 인증키가 올바르지 않습니다.", 502, text.slice(0, 200));
  }
  return new UpstreamError(
    `공공데이터포털 응답을 처리하지 못했습니다. (HTTP ${status})`,
    502,
    (authMsg ?? text).slice(0, 200),
  );
}

// 정상 응답이면 JSON 객체를, 게이트웨이 오류면 UpstreamError를 던진다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDataGoKr(status: number, ok: boolean, text: string): any {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw dataGoKrError(status, text);
  }
  if (!ok || json?.OpenAPI_ServiceResponse) throw dataGoKrError(status, text);
  return json;
}

export function errorResponse(err: unknown) {
  if (err instanceof UpstreamError) {
    return Response.json({ error: err.message, detail: err.detail }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "서버에서 알 수 없는 오류가 발생했습니다." }, { status: 500 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// 동시에 너무 많이 호출하지 않도록 n개씩 나눠서 실행
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = await Promise.all(items.slice(i, i + limit).map(fn));
    results.push(...chunk);
  }
  return results;
}
