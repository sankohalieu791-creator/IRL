"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

type AdminMessageInputProps = {
  groupId: string
  sender: string
  onSent?: () => void
}

export default function AdminMessageInput({ groupId, sender, onSent }: AdminMessageInputProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  async function sendMessage() {
    if (!message.trim()) return

    setSending(true)

    const { error } = await supabase.from("group_messages").insert({
      group_id: groupId,
      sender,
      message: message.trim(),
      media_type: "text"
    })

    setSending(false)

    if (error) {
      alert(`Error sending message: ${error.message}`)
      return
    }

    setMessage("")
    onSent?.()
  }

  return (
    <div className="flex flex-col px-4 pb-4 pt-2 border-t border-zinc-800 bg-zinc-950/90">
      <div className="flex items-center gap-3">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              sendMessage()
            }
          }}
          className="flex-1 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          placeholder="Send an admin message..."
          disabled={sending}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={sending}
          className="rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  )
}
