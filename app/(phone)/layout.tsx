export default function PhoneLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Phone frame — desktop only */}
      <div className="hidden md:flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="relative w-[390px] h-[844px] bg-black rounded-[50px] border-[6px] border-zinc-700 overflow-hidden shadow-2xl flex flex-col">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-50" />
          <div className="flex flex-col flex-1 overflow-hidden mt-7">
            {children}
          </div>
        </div>
      </div>

      {/* Full screen — mobile only */}
      <div
        className="flex md:hidden flex-col w-full bg-black overflow-hidden"
        style={{ height: "100dvh" }}
      >
        {children}
      </div>
    </>
  )
}