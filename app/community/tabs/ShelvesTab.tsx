"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import { apiFetch } from "@/lib/api-client"
import { useSessionStore } from "@/hooks/sessionStore"

import { loadCollectionPerfumeOptions, postCommunity } from "./community-api"
import type { PerfumeOption, Shelf } from "./types"

type ShelvesTabProps = {
  onMessage: (message: string | null) => void
  onError: (error: string | null) => void
}

export const ShelvesTab = ({ onMessage, onError }: ShelvesTabProps) => {
  const t = useTranslations("community")
  const { modalOpen, modalId, modalData, openModal, closeModal } = useSessionStore()
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [perfumeOptions, setPerfumeOptions] = useState<PerfumeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [shelfName, setShelfName] = useState("")
  const [shelfPublic, setShelfPublic] = useState(false)
  const [addShelfId, setAddShelfId] = useState("")
  const [addPerfumeId, setAddPerfumeId] = useState("")

  const loadShelves = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const data = await apiFetch<{ shelves: Shelf[] }>("/api/community?kind=shelves")
      const nextShelves = data.shelves ?? []
      setShelves(nextShelves)
      setAddShelfId(prev => prev || nextShelves[0]?.id || "")
    } catch (e) {
      onError(e instanceof Error ? e.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [onError, t])

  useEffect(() => {
    void loadShelves()
  }, [loadShelves])

  useEffect(() => {
    void loadCollectionPerfumeOptions()
      .then(opts => {
        setPerfumeOptions(opts)
        if (opts[0]) setAddPerfumeId(prev => prev || opts[0]!.perfumeId)
      })
      .catch(() => {
        /* collection optional */
      })
  }, [])

  const createShelf = async (e: React.FormEvent) => {
    e.preventDefault()
    onMessage(null)
    onError(null)
    try {
      await postCommunity({
        intent: "create-shelf",
        name: shelfName,
        isPublic: shelfPublic,
      })
      setShelfName("")
      onMessage(t("shelfCreated"))
      await loadShelves()
    } catch (err) {
      onError(err instanceof Error ? err.message : t("saveError"))
    }
  }

  const addToShelf = async (e: React.FormEvent) => {
    e.preventDefault()
    onMessage(null)
    onError(null)
    try {
      await postCommunity({
        intent: "add-to-shelf",
        shelfId: addShelfId,
        perfumeId: addPerfumeId,
      })
      onMessage(t("perfumeAdded"))
      await loadShelves()
    } catch (err) {
      onError(err instanceof Error ? err.message : t("saveError"))
    }
  }

  const deleteShelf = async (shelfId: string) => {
    closeModal()
    onMessage(null)
    onError(null)
    try {
      await postCommunity({
        intent: "delete-shelf",
        shelfId,
      })
      onMessage(t("shelfDeleted"))
      setAddShelfId(prev => (prev === shelfId ? "" : prev))
      await loadShelves()
    } catch (err) {
      onError(err instanceof Error ? err.message : t("saveError"))
    }
  }

  if (loading) {
    return <p className="text-sm opacity-70">{t("loading")}</p>
  }

  return (
    <>
      {modalOpen && modalId === "delete-shelf" && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={t("deleteShelfHeading")}
            description={t("deleteShelfDescription", {
              name: typeof modalData?.name === "string" ? modalData.name : "",
            })}
            action={() => {
              const shelfId =
                typeof modalData?.shelfId === "string" ? modalData.shelfId : ""
              if (shelfId) void deleteShelf(shelfId)
            }}
          />
        </Modal>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg text-noir-gold-500">{t("createShelfTitle")}</h2>
          <form onSubmit={createShelf} className="space-y-3">
            <label className="block text-sm">
              <span className="opacity-80">{t("shelfName")}</span>
              <input
                value={shelfName}
                onChange={e => setShelfName(e.target.value)}
                required
                maxLength={80}
                className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2 text-noir-gold-100"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shelfPublic}
                onChange={e => setShelfPublic(e.target.checked)}
              />
              {t("shelfPublic")}
            </label>
            <button
              type="submit"
              className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5"
            >
              {t("createShelf")}
            </button>
          </form>

          {shelves.length > 0 && perfumeOptions.length > 0 && (
            <form onSubmit={addToShelf} className="space-y-3 pt-4 border-t border-noir-gold/15">
              <h3 className="text-sm text-noir-gold-500">{t("addToShelfTitle")}</h3>
              <label className="block text-sm">
                <span className="opacity-80">{t("shelf")}</span>
                <select
                  value={addShelfId || shelves[0]?.id || ""}
                  onChange={e => setAddShelfId(e.target.value)}
                  className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
                >
                  {shelves.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="opacity-80">{t("perfume")}</span>
                <select
                  value={addPerfumeId}
                  onChange={e => setAddPerfumeId(e.target.value)}
                  className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
                >
                  {perfumeOptions.map(p => (
                    <option key={p.perfumeId} value={p.perfumeId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5"
              >
                {t("addPerfume")}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg text-noir-gold-500">{t("yourShelves")}</h2>
          {shelves.length === 0 ? (
            <p className="text-sm opacity-70">{t("noShelves")}</p>
          ) : (
            <ul className="space-y-4">
              {shelves.map(shelf => (
                <li key={shelf.id} className="noir-border rounded-lg p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-noir-gold-500 font-medium">{shelf.name}</h3>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs opacity-60">
                        {shelf.isPublic ? t("public") : t("private")}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openModal("delete-shelf", {
                            shelfId: shelf.id,
                            name: shelf.name,
                          })
                        }
                        className="text-xs uppercase tracking-wide text-red-300/90 hover:text-red-200 hover:underline"
                      >
                        {t("deleteShelf")}
                      </button>
                    </div>
                  </div>
                  {shelf.description && (
                    <p className="text-sm opacity-70 mt-1">{shelf.description}</p>
                  )}
                  <ul className="mt-3 space-y-1 text-sm">
                    {shelf.items.length === 0 ? (
                      <li className="opacity-60">{t("emptyShelf")}</li>
                    ) : (
                      shelf.items.map(item => (
                        <li key={item.id}>
                          <PrefetchLink
                            href={`/perfume/${item.perfume.slug}`}
                            className="hover:underline text-noir-gold-100"
                          >
                            {item.perfume.name}
                          </PrefetchLink>
                        </li>
                      ))
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
