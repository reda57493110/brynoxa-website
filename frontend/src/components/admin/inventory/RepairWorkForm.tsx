import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/store/toastStore'
import type { RepairDetail, RepairStatus } from '@/types'
import { REPAIR_STATUS_LABELS, invalidateInventory, nativeSelect, parseList } from './MovementLabels'

type WorkStatus = Exclude<RepairStatus, 'qc-passed' | 'qc-failed'>
const WORK_STATUSES: WorkStatus[] = ['awaiting-diagnosis', 'awaiting-parts', 'in-repair', 'repair-completed', 'qc-pending']

/** Diagnosis / progress updates while a repair is open. */
export function RepairWorkForm({ repair }: { repair: RepairDetail }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<WorkStatus>(
    (WORK_STATUSES as RepairStatus[]).includes(repair.status) ? (repair.status as WorkStatus) : 'awaiting-diagnosis'
  )
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? '')
  const [technician, setTechnician] = useState(repair.technician ?? '')
  const [parts, setParts] = useState(repair.partsReplaced.join('\n'))
  const [cost, setCost] = useState(repair.cost ? String(repair.cost) : '')
  const [note, setNote] = useState('')

  const c = cost.trim() === '' ? 0 : Number(cost)
  const costError = !Number.isFinite(c) || c < 0 ? 'Enter 0 or more' : undefined
  const partList = parseList(parts)
  const partsError = partList.length > 30 ? 'At most 30 parts' : partList.some((p) => p.length > 120) ? 'Each part at most 120 characters' : undefined

  const save = useMutation({
    mutationFn: async () =>
      (
        await inventoryApi.updateRepair(repair._id, {
          status,
          diagnosis: diagnosis.trim(),
          technician: technician.trim(),
          partsReplaced: partList,
          cost: c,
          note: note.trim() || undefined,
        })
      ).data.data,
    onSuccess: () => {
      invalidateInventory(qc)
      setNote('')
      toast.success('Repair updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!costError && !partsError) save.mutate()
      }}
    >
      <h2 className="font-semibold">Work</h2>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium">Status</span>
          <select className={nativeSelect} value={status} onChange={(e) => setStatus(e.target.value as WorkStatus)}>
            {WORK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REPAIR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <Input label="Technician" maxLength={120} value={technician} onChange={(e) => setTechnician(e.target.value)} />
        <Input
          label="Repair cost (DH)"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          error={costError}
        />
      </div>
      <Textarea label="Diagnosis" rows={2} className="min-h-16" maxLength={1000} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
      <Textarea
        label="Parts replaced (comma or one per line)"
        rows={2}
        className="min-h-16"
        value={parts}
        onChange={(e) => setParts(e.target.value)}
        error={partsError}
      />
      <Input label="Note for history" maxLength={500} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" size="sm" loading={save.isPending}>
        Save
      </Button>
    </form>
  )
}
