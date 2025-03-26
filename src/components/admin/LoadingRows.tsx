export function LoadingRows() {
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left border-b border-gray-700">
          <th className="pb-3 text-gray-400 font-medium">User</th>
          <th className="pb-3 text-gray-400 font-medium">Role</th>
          <th className="pb-3 text-gray-400 font-medium">Companies</th>
          <th className="pb-3 text-gray-400 font-medium">Manage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-700">
        {[...Array(5)].map((_, i) => (
          <tr key={i}>
            <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-48 animate-pulse" /></td>
            <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-24 animate-pulse" /></td>
            <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-32 animate-pulse" /></td>
            <td className="py-4"><div className="h-6 bg-light-blue/50 rounded w-40 animate-pulse" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}