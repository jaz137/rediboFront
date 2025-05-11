"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import Header from "@/components/ui/Header"
import { Footer } from "@/components/ui/footer"
import leoProfanity from "leo-profanity"
import { API_URL } from "@/utils/bakend"
import "./styles.css"

// Extender la definicion de tipos para leo-profanity
declare module "leo-profanity" {
  export function getDictionary(lang: string): string[]
  export function add(words: string[]): void
  export function clean(text: string): string
  export function check(text: string): boolean
}

interface Renter {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  profilePicture: string
  rated?: boolean
  fechaFin?: Date
  idReserva?: string
  carImage?: string
}

interface Calificacion {
  id: string
  renterId: string
  comportamiento: number
  cuidado_vehiculo: number
  puntualidad: number
  comentario: string
  fecha: Date
  renter: {
    id: string
    nombre: string
    foto?: string
  }
  reservaId?: string
  hostPicture?: string
  hostName?: string
}

export default function CalificacionesAlRenterPage() {
  const [hostId, setHostId] = useState<string | null>(null)
  const [renters, setRenters] = useState<Renter[]>([])
  const [selected, setSelected] = useState<Renter | null>(null)
  const [rating, setRating] = useState<{
    comportamiento: number
    cuidado_vehiculo: number
    puntualidad: number
    comentario: string
  }>({
    comportamiento: 0,
    cuidado_vehiculo: 0,
    puntualidad: 0,
    comentario: "",
  })
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showRatingPanel, setShowRatingPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comentarioOfensivo, setComentarioOfensivo] = useState(false)

  // Cargar el diccionario de palabras ofensivas
  useEffect(() => {
    try {
      // Cargar el diccionario en español
      leoProfanity.add(leoProfanity.getDictionary("es"))

      // Agregar palabras adicionales al diccionario
      leoProfanity.add([
        "puta",
        "mierda",
        "cabrón",
        "joder",
        "coño",
        "gilipollas",
        "capullo",
        "idiota",
        "imbécil",
        "pendejo",
        "marica",
        "maricón",
        "cojones",
        "hostia",
        "hijo de puta",
        "hijoputa",
        "malparido",
        "cabron",
      ])
    } catch (error) {
      console.error("Error al cargar el diccionario:", error)
    }
  }, [])

  // Obtener el ID del usuario autenticado
  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      const fetchUserId = async () => {
        try {
          const response = await fetch(`${API_URL}/api/perfil`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          if (response.ok) {
            const userData = await response.json()
            setHostId(userData.id.toString())
          } else {
            console.error("Error al obtener el perfil del usuario")
          }
        } catch (error) {
          console.error("Error al obtener el ID del usuario:", error)
        }
      }

      fetchUserId()
    }
  }, [])

  // Cargar datos cuando se obtiene el hostId
  useEffect(() => {
    if (!hostId) return

    async function fetchData() {
      setIsLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem("auth_token")
        if (!token) {
          throw new Error("No se encontró el token de autenticación")
        }

        console.log("Fetching data for hostId:", hostId)

        // Fetch rentals from API - Modificado para coincidir con el modelo Reserva
        const rentalsResponse = await fetch(`${API_URL}/api/reservas/completadas?hostId=${hostId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!rentalsResponse.ok) {
          throw new Error("Error al cargar rentas completadas")
        }
        const rentalsData = await rentalsResponse.json()

        // Fetch ratings from API - Modificado para coincidir con el modelo CalificacionReserva
        const ratingsResponse = await fetch(`${API_URL}/api/calificaciones-reserva?hostId=${hostId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!ratingsResponse.ok) {
          throw new Error("Error al cargar calificaciones")
        }
        const ratingsData = await ratingsResponse.json()
        const calificacionesMapeadas = (ratingsData as any[]).map((c: any) => ({
          id: c.id,
          renterId: c.reserva?.usuario?.id,
          reservaId: c.reserva?.id,
          comportamiento: c.comportamiento,
          cuidado_vehiculo: c.cuidado_vehiculo,
          puntualidad: c.puntualidad,
          comentario: c.comentario,
          fecha: c.fecha_creacion,
          renter: {
            id: c.reserva?.usuario?.id || "",
            nombre: c.reserva?.usuario?.nombre || "Usuario",
            foto: c.reserva?.usuario?.foto,
          },
          hostPicture: c.reserva?.carro?.usuario?.foto || "/placeholder.svg",
          hostName: c.reserva?.carro?.usuario?.nombre || "Anfitrión",
        }))
        setCalificaciones(calificacionesMapeadas)

        const uniqueRenters = rentalsData.reduce((acc: Renter[], rental: any) => {
          const existingCalificacion = calificacionesMapeadas.find((c) => c.reservaId === rental.id)
          const carImage = rental.carro?.imagenes?.[0]?.data || "/placeholder_car.svg"
          if (!acc.find((r) => r.id === rental.usuario.id && r.idReserva === rental.id)) {
            acc.push({
              id: rental.usuario.id,
              firstName: rental.usuario.nombre.split(" ")[0],
              lastName: rental.usuario.nombre.split(" ").slice(1).join(" "),
              email: rental.usuario.correo,
              phone: rental.usuario.telefono || "",
              profilePicture: rental.usuario.foto || "/placeholder.svg",
              idReserva: rental.id,
              fechaFin: rental.fecha_fin,
              rated: !!existingCalificacion,
              carImage,
            })
          }
          return acc
        }, [])

        setRenters(uniqueRenters)
      } catch (error) {
        setError("No se pudieron cargar los datos. ¿Estás autenticado?")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [hostId])

  function estaDentroDePeriodoCalificacion(fechaFin: string): boolean {
    const fechaFinRenta = new Date(fechaFin)
    const fechaActual = new Date()

    fechaFinRenta.setHours(0, 0, 0, 0)
    fechaActual.setHours(0, 0, 0, 0)

    const diferenciaTiempo = fechaActual.getTime() - fechaFinRenta.getTime()
    const diferenciaDias = Math.floor(diferenciaTiempo / (1000 * 3600 * 24))

    return diferenciaDias <= 2
  }

  function handleSeleccionar(renter: Renter) {
    if (renter.rated || estaDentroDePeriodoCalificacion(renter.fechaFin?.toString() || "")) {
      const calificacion = calificaciones.find((c) => c.reservaId === renter.idReserva)
      if (calificacion) {
        setRating({
          comportamiento: calificacion.comportamiento,
          cuidado_vehiculo: calificacion.cuidado_vehiculo,
          puntualidad: calificacion.puntualidad,
          comentario: calificacion.comentario,
        })
      } else {
        setRating({
          comportamiento: 0,
          cuidado_vehiculo: 0,
          puntualidad: 0,
          comentario: "",
        })
      }

      setSelected(renter)
      setShowRatingPanel(true)
    }
  }

  async function handleGuardar() {
    try {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        throw new Error("No se encontró el token de autenticación")
      }

      if (!selected) return

      // Validar que todas las calificaciones estén completas
      if (
        rating.comportamiento === 0 ||
        rating.cuidado_vehiculo === 0 ||
        rating.puntualidad === 0
      ) {
        setError("Por favor, completa todas las calificaciones")
        return
      }

      // Validar comentario ofensivo
      if (leoProfanity.check(rating.comentario)) {
        setComentarioOfensivo(true)
        setError("El comentario contiene lenguaje inapropiado")
        return
      }

      const existingRating = calificaciones.find(
        (c) => c.renterId === selected.id && c.reservaId === selected.idReserva
      )

      const url = existingRating
        ? `${API_URL}/api/calificaciones-reserva/${existingRating.id}`
        : `${API_URL}/api/calificaciones-reserva`

      const method = existingRating ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_reserva: selected.idReserva,
          comportamiento: rating.comportamiento,
          cuidado_vehiculo: rating.cuidado_vehiculo,
          puntualidad: rating.puntualidad,
          comentario: rating.comentario,
        }),
      })

      if (!response.ok) {
        let errorMsg = "Error al guardar la calificación";
        try {
          const errorData = await response.json();
          errorMsg = errorData?.error || errorMsg;
          console.error("Error al guardar la calificación:", errorData);
        } catch (e) {
          console.error("Error al parsear la respuesta de error:", e);
        }
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Actualizar la lista de calificaciones
      const updatedRating = await response.json()
      const newCalificacion = {
        id: updatedRating.id,
        renterId: selected.id,
        comportamiento: rating.comportamiento,
        cuidado_vehiculo: rating.cuidado_vehiculo,
        puntualidad: rating.puntualidad,
        comentario: rating.comentario,
        fecha: new Date(),
        renter: {
          id: selected.id,
          nombre: `${selected.firstName} ${selected.lastName}`,
          foto: selected.profilePicture,
        },
        reservaId: selected.idReserva,
      }

      if (existingRating) {
        setCalificaciones(
          calificaciones.map((c) =>
            c.id === existingRating.id ? newCalificacion : c
          )
        )
      } else {
        setCalificaciones([...calificaciones, newCalificacion])
      }

      // Actualizar el estado de rated en el renter seleccionado
      setRenters(
        renters.map((r) =>
          r.id === selected.id && r.idReserva === selected.idReserva
            ? { ...r, rated: true }
            : r
        )
      )

      setShowRatingPanel(false)
      setSelected(null)
      setRating({
        comportamiento: 0,
        cuidado_vehiculo: 0,
        puntualidad: 0,
        comentario: "",
      })
      setError(null)
      setComentarioOfensivo(false)
    } catch (error) {
      console.error("Error al guardar la calificación:", error)
      setError("Error al guardar la calificación")
    }
  }

  async function handleBorrar(renter: Renter) {
    console.log("Comparando:", {
      buscarRenterId: String(renter.id),
      buscarReservaId: String(renter.idReserva),
      calificaciones: calificaciones.map(c => ({
        id: c.id,
        renterId: String(c.renterId),
        reservaId: String(c.reservaId)
      }))
    });
    const calificacion = calificaciones.find(
      (c) =>
        String(c.renterId || "") === String(renter.id || "") &&
        String(c.reservaId || "") === String(renter.idReserva || "")
    )
    if (!calificacion) {
      alert("No se encontró la calificación para este arrendatario/reserva.");
      return;
    }
    try {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        throw new Error("No se encontró el token de autenticación")
      }

      const response = await fetch(
        `${API_URL}/api/calificaciones-reserva/${calificacion.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("Error al borrar la calificación")
      }

      // Actualizar la lista de calificaciones
      setCalificaciones(
        calificaciones.filter((c) => c.id !== calificacion.id)
      )

      // Actualizar el estado de rated en el renter
      setRenters(
        renters.map((r) =>
          r.id === renter.id && r.idReserva === renter.idReserva
            ? { ...r, rated: false }
            : r
        )
      )

      if (selected?.id === renter.id) {
        setShowRatingPanel(false)
        setSelected(null)
        setRating({
          comportamiento: 0,
          cuidado_vehiculo: 0,
          puntualidad: 0,
          comentario: "",
        })
      }
    } catch (error) {
      console.error("Error al borrar la calificación:", error)
      setError("Error al borrar la calificación")
    }
  }

  function calcularPromedio() {
    if (
      rating.comportamiento === undefined &&
      rating.cuidado_vehiculo === undefined &&
      rating.puntualidad === undefined
    ) {
      return 0
    }
    const suma = rating.comportamiento + rating.cuidado_vehiculo + rating.puntualidad
    const categoriasPuntuadas = [rating.comportamiento, rating.cuidado_vehiculo, rating.puntualidad].filter(
      (val) => val !== undefined,
    ).length
    return categoriasPuntuadas > 0 ? Math.round((suma / categoriasPuntuadas) * 10) / 10 : 0
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.getMonth()
    const year = date.getFullYear()

    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ]

    return `${day} ${months[month]}, ${year}`
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Calificaciones al Arrendatario</h1>

        {!hostId ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Cargando información...</p>
          </div>
        ) : (
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {error && <div className="text-red-500">{error}</div>}
                <div className="rental-container">
                  <div className="rental-history-panel">
                    <div className="rental-header">
                      <h2 className="rental-title">Historial de rentas</h2>
                      <div className="rental-count">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>{renters.length} Rentas completadas</span>
                      </div>
                    </div>

                    <div className="rental-list">
                      {Array.isArray(renters) && renters.length > 0 ? (
                        renters.map((renter) => {
                          const calificacion = calificaciones.find((c) => c.reservaId === renter.idReserva)
                          const carImage = renter.carImage || "/placeholder_car.svg"
                          return (
                            <div key={renter.id} className="rental-item">
                              <div className="rental-item-left">
                                <div className="rental-image-placeholder">
                                  <img
                                    src={renter.carImage || "/placeholder_car.svg"}
                                    alt="Imagen del auto"
                                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }}
                                  />
                                </div>
                                <div className="rental-user-avatar">
                                  <img
                                    src={renter.profilePicture || "/placeholder.svg"}
                                    alt={`${renter.firstName} ${renter.lastName}`}
                                    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                                  />
                                </div>
                                <div className="rental-user-info">
                                  <div className="rental-user-name">
                                    {renter.firstName} {renter.lastName}
                                  </div>
                                  <div className="rental-car-info">
                                    {renter.firstName} {renter.lastName}
                                  </div>
                                  <div className="rental-status">
                                    {calificacion ? (
                                      <div className="rating-display">
                                        {[1, 2, 3, 4, 5].map((star) => {
                                          const promedio =
                                            (calificacion.comportamiento +
                                              calificacion.cuidado_vehiculo +
                                              calificacion.puntualidad) /
                                            3
                                          return (
                                            <span
                                              key={star}
                                              className="star-icon-small"
                                              style={{ color: star <= Math.round(promedio) ? "#facc15" : "#e5e7eb" }}
                                            >
                                              ★
                                            </span>
                                          )
                                        })}
                                        <span className="rating-value">
                                          (
                                          {(
                                            (calificacion.comportamiento +
                                              calificacion.cuidado_vehiculo +
                                              calificacion.puntualidad) /
                                            3
                                          ).toFixed(1)}
                                          )
                                        </span>
                                        {calificacion.comentario && (
                                          <span className="has-comment-indicator" title="Tiene comentario">
                                            💬
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Sin calificar</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="rental-item-right">
                                <div className="rental-date">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                  </svg>
                                  <span>{formatDate(renter.fechaFin?.toString() || "")}</span>
                                </div>

                                <div className="rental-actions">
                                  {!estaDentroDePeriodoCalificacion(renter.fechaFin?.toString() || "") &&
                                  !renter.rated ? (
                                    <button className="calificar-button disabled" disabled>
                                      Fuera de plazo
                                    </button>
                                  ) : renter.rated ? (
                                    <>
                                      <button
                                        onClick={() => handleSeleccionar(renter)}
                                        className="calificar-button rated"
                                      >
                                        Calificado
                                      </button>
                                      {estaDentroDePeriodoCalificacion(renter.fechaFin?.toString() || "") && (
                                        <button
                                          onClick={() => {
                                            alert("Intentando borrar");
                                            handleBorrar(renter);
                                          }}
                                          className="delete-button"
                                          aria-label="Eliminar calificación"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <button onClick={() => handleSeleccionar(renter)} className="calificar-button">
                                      Calificar
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="no-rentals">No hay rentas completadas disponibles</div>
                      )}
                    </div>
                  </div>

                  {showRatingPanel && selected && (
                    <div className="rating-panel">
                      <div className="rating-panel-header">
                        <div className="rating-user-info">
                          <h3>
                            {selected.firstName} {selected.lastName}
                          </h3>
                          <div className="rating-date">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span>{formatDate(selected.fechaFin?.toString() || "")}</span>
                          </div>
                        </div>

                        <div className="rating-car-details">
                          <div className="rental-image-placeholder">
                            <img
                              src={selected?.carImage || "/placeholder_car.svg"}
                              alt="Imagen del auto"
                              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }}
                            />
                          </div>
                          <div className="rating-car-info">
                            <div className="rating-car-model">
                              {selected.firstName} {selected.lastName}
                            </div>
                            <div className="rating-car-status">Completado</div>
                          </div>
                        </div>
                      </div>

                      <div className="rating-panel-content">
                        <div className="rating-summary">
                          <h4>Calificación actual</h4>

                          <div className="rating-final-score">
                            <div className="rating-score-label">Puntuación final</div>
                            <div className="rating-score-value">
                              <span className="rating-score-number">{calcularPromedio().toFixed(1)}</span>
                              <span className="rating-score-star">★</span>
                            </div>
                            <div className="rating-stars-display">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className="star-icon-large"
                                  style={{ color: star <= Math.round(calcularPromedio()) ? "#facc15" : "#e5e7eb" }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <div className="rating-score-note">Promedio de las tres calificaciones</div>
                          </div>

                          <div className="rating-categories">
                            <div className="rating-category">
                              <div className="rating-category-label">
                                <span>Comportamiento</span>
                                <span className="rating-category-question">
                                  ¿Cómo fue el comportamiento del arrendatario?
                                </span>
                              </div>
                              <div className="rating-category-stars">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    onClick={() => {
                                      if (
                                        !selected.rated &&
                                        estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                                      ) {
                                        setRating((prev) => ({ ...prev, comportamiento: star }))
                                      }
                                    }}
                                    className={`star-icon-medium ${star <= rating.comportamiento ? "active" : ""}`}
                                    style={{
                                      cursor:
                                        !selected.rated &&
                                        estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                                          ? "pointer"
                                          : "default",
                                      color: star <= rating.comportamiento ? "#facc15" : "#e5e7eb",
                                    }}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="rating-category">
                              <div className="rating-category-label">
                                <span>Cuidado del vehículo</span>
                                <span className="rating-category-question">
                                  ¿Cómo cuidó el arrendatario tu vehículo?
                                </span>
                              </div>
                              <div className="rating-category-stars">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    onClick={() => {
                                      if (
                                        !selected.rated &&
                                        estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                                      ) {
                                        setRating((prev) => ({ ...prev, cuidado_vehiculo: star }))
                                      }
                                    }}
                                    className={`star-icon-medium ${star <= rating.cuidado_vehiculo ? "active" : ""}`}
                                    style={{
                                      cursor:
                                        !selected.rated &&
                                        estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                                          ? "pointer"
                                          : "default",
                                      color: star <= rating.cuidado_vehiculo ? "#facc15" : "#e5e7eb",
                                    }}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="rating-category">
                              <div className="rating-category-label">
                                <span>Puntualidad</span>
                                <span className="rating-category-question">
                                  ¿Fue puntual en la entrega y devolución?
                                </span>
                              </div>
                              <div className="rating-category-stars">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    onClick={() => {
                                      if (
                                        !selected.rated &&
                                        estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                                      ) {
                                        setRating((prev) => ({ ...prev, puntualidad: star }))
                                      }
                                    }}
                                    className={`star-icon-medium ${star <= rating.puntualidad ? "active" : ""}`}
                                    style={{
                                      cursor:
                                        !selected.rated &&
                                        estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                                          ? "pointer"
                                          : "default",
                                      color: star <= rating.puntualidad ? "#facc15" : "#e5e7eb",
                                    }}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Añadir después de la última categoría (puntualidad) y antes de los botones de acción */}
                        <div className="rating-category">
                          <h4 className="mb-2 font-medium text-gray-700">Comentario general</h4>
                          <textarea
                            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                            placeholder="Añade un comentario general sobre tu experiencia con este arrendatario..."
                            value={rating.comentario}
                            onChange={(e) => {
                              const value = e.target.value
                              setRating((prev) => ({ ...prev, comentario: value }))
                              setComentarioOfensivo(!!value && value !== leoProfanity.clean(value))
                            }}
                            disabled={
                              selected.rated && !estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                            }
                            rows={4}
                            maxLength={500} // <- Nuevo límite superior
                          />
                        </div>

                        {/* NUEVO CONTENEDOR PARA MENSAJES DE VALIDACIÓN */}
                        <div className="mt-2 text-sm text-gray-500">
                          {!rating.comentario && (
                            <div className="comment-feedback">
                              Puedes añadir un comentario sobre tu experiencia con este arrendatario
                            </div>
                          )}

                          {rating.comentario && (
                            <>
                              <div className="comment-char-count">{rating.comentario.length} / 500 caracteres</div>

                              {/* Validación del mínimo */}
                              {rating.comentario.length < 10 && (
                                <div className="text-red-600 mt-1">
                                  El comentario debe tener al menos 10 caracteres.
                                </div>
                              )}

                              {/* Filtro de lenguaje inapropiado */}
                              {comentarioOfensivo && (
                                <div className="text-red-600 mt-1 font-medium">
                                  Tu comentario contiene palabras ofensivas o no permitidas y no puede ser guardado.
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="rating-actions">
                          {!selected.rated && estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "") && (
                            <button
                              onClick={handleGuardar}
                              disabled={
                                !rating.comportamiento ||
                                !rating.cuidado_vehiculo ||
                                !rating.puntualidad ||
                                comentarioOfensivo
                              }
                              className="save-rating-button"
                            >
                              Guardar calificación
                            </button>
                          )}

                          <button
                            onClick={() => {
                              alert("Intentando borrar");
                              handleBorrar(selected);
                            }}
                            className="delete-rating-button"
                          >
                            <Trash2 size={16} />
                            Borrar calificación
                          </button>

                          <button onClick={() => setShowRatingPanel(false)} className="close-rating-button">
                            {selected.rated || !estaDentroDePeriodoCalificacion(selected.fechaFin?.toString() || "")
                              ? "Cerrar"
                              : "Cancelar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!showRatingPanel && (
                    <div className="empty-rating-panel">
                      <div className="empty-rating-icon">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="64"
                          height="64"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
                        </svg>
                      </div>
                      <h3>Selecciona un arrendatario</h3>
                      <p>Selecciona un arrendatario de la lista para calificar su experiencia de renta</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}