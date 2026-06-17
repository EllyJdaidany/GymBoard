export default function PRBoardTable({ members }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-slate-400">
          <tr>
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Squat</th>
            <th className="px-4 py-3">Bench</th>
            <th className="px-4 py-3">Deadlift</th>
            <th className="px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ member }) => (
            <tr key={member.id} className="border-b border-slate-800/60">
              <td className="px-4 py-3 font-medium">
                {member.first_name} {member.last_name}
              </td>
              <td className="px-4 py-3" colSpan={4}>
                <span className="text-slate-500">—</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
