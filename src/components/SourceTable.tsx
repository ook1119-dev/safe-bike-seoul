export type SourceRow = {
  label: string;
  source: string;
  href: string;
  basis: string;
  fetchedAt: string;
  status: "ok" | "loading" | "error" | "idle" | "partial";
};

const STATUS_TEXT: Record<SourceRow["status"], string> = {
  ok: "정상",
  loading: "조회 중",
  error: "실패",
  idle: "미조회",
  partial: "일부 실패",
};

export default function SourceTable({ rows }: { rows: SourceRow[] }) {
  return (
    <section className="card" id="sources">
      <div className="card-head">
        <h2>정보 출처와 기준시각</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>정보</th>
              <th>출처</th>
              <th>측정·발표·통계 기준</th>
              <th>서버 조회시각</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  <a href={row.href} target="_blank" rel="noopener noreferrer">
                    {row.source}
                  </a>
                </td>
                <td>{row.basis}</td>
                <td>{row.fetchedAt}</td>
                <td>
                  <span className={`badge is-${row.status}`}>{STATUS_TEXT[row.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">모든 시각은 한국 표준시(KST) 기준입니다.</p>
    </section>
  );
}
