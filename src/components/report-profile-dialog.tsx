"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { API_URL } from "@/utils/bakend"

interface ReportProfileDialogProps {
  children: React.ReactNode
  renterId: string
  renterName: string
}

export default function ReportProfileDialog({ children, renterId, renterName }: ReportProfileDialogProps) {
  const [reason, setReason] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un motivo para el reporte",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const token = localStorage.getItem("auth_token")
      const response = await fetch(`${API_URL}/api/reportes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
        renterId,
        renterName,
        reason,
        additionalInfo,
        }),
      })

      if (!response.ok) throw new Error("No se pudo enviar el reporte")

      toast({
        title: "Reporte enviado",
        description: "Su reporte ha sido enviado correctamente y será revisado por nuestro equipo.",
      })

      setReason("")
      setAdditionalInfo("")
      setIsOpen(false)
    } catch (error) {
      console.error("Error submitting report:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el reporte. Intente nuevamente.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar a {renterName}</DialogTitle>
          <DialogDescription>
            Por favor, indique el motivo por el cual está reportando a este arrendatario. Los reportes son anónimos y
            serán revisados por nuestro equipo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo del reporte</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="información_falsa">Información falsa en el perfil</SelectItem>
                <SelectItem value="comportamiento_inapropiado">Comportamiento inapropiado</SelectItem>
                <SelectItem value="daños_propiedad">Daños a la propiedad</SelectItem>
                <SelectItem value="incumplimiento_normas">Incumplimiento de normas</SelectItem>
                <SelectItem value="otro">Otro motivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Información adicional</label>
            <Textarea
              placeholder="Proporcione detalles adicionales sobre el reporte..."
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar reporte"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
