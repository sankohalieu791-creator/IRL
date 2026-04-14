import AuthGuard from "@/components/AuthGuard"

export default function PhoneLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Phone frame — desktop only */}
      <div className="hidden md:flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="relative w-[390px] h-[844px] bg-black rounded-[50px] border-[6px] border-zinc-700 shadow-2xl flex flex-col overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-50" />
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden mt-7">
            <AuthGuard>{children}</AuthGuard>
          </div>
        </div>
      </div>

      {/* Full screen — mobile only */}
      <div
        className="flex md:hidden flex-col w-full bg-black"
        style={{ height: "100dvh", overflow: "hidden" }}
      >
        <AuthGuard>{children}</AuthGuard>
      </div>
    </>
  )
}
