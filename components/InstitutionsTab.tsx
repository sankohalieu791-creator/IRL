"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Institution = {
  id: string
  name: string
  type: string
  created_at: string
}

export default function InstitutionsTab({ school }: { school: string }) {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [newInstitution, setNewInstitution] = useState({ name: "", type: "school" })

  useEffect(() => {
    loadInstitutions()
  }, [])

  async function loadInstitutions() {
    const { data } = await supabase
      .from("institutions")
      .select("*")
      .order("name", { ascending: true })
    if (data) setInstitutions(data)
  }

  async function createInstitution() {
    if (!newInstitution.name) return alert("Please enter an institution name")
    const { error } = await supabase
      .from("institutions")
      .insert({ name: newInstitution.name, type: newInstitution.type })
    if (error) return alert(`Error: ${error.message}`)
    setNewInstitution({ name: "", type: "school" })
    loadInstitutions()
    alert("Institution added!")
  }

  async function deleteInstitution(id: string) {
    if (!confirm("Delete this institution?")) return
    await supabase.from("institutions").delete().eq("id", id)
    loadInstitutions()
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-bold text-white">Register Institution</h2>
        <input
          placeholder="Institution name"
          value={newInstitution.name}
          onChange={e => setNewInstitution(p => ({ ...p, name: e.target.value }))}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
        />
        <select
          value={newInstitution.type}
          onChange={e => setNewInstitution(p => ({ ...p, type: e.target.value }))}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
        >
          <option value="school">School</option>
          <option value="college">College</option>
          <option value="university">University</option>
        </select>
        <button
          onClick={createInstitution}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          🏫 Register Institution
        </button>
      </div>

      <h2 className="text-lg font-bold text-white">All Institutions</h2>
      {institutions.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
          No institutions registered yet
        </div>
      )}
      {institutions.map(i => (
        <div key={i.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center">
          <div>
            <p className="font-bold text-white">{i.name}</p>
            <p className="text-zinc-500 text-sm capitalize">{i.type}</p>
          </div>
          <button
            onClick={() => deleteInstitution(i.id)}
            className="text-red-400 text-sm border border-red-400/30 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}