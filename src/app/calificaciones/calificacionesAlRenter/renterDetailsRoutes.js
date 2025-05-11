const express = require("express")
const { prisma } = require("../lib/prisma")
const { getUserId } = require("../lib/auth")

const router = express.Router()

// GET /api/renter-details?renterId=...
router.get("/", async (req, res) => {
  try {
    const { renterId } = req.query

    if (!renterId) {
      return res.status(400).json({ error: "Falta el renterId" })
    }

    // Verificar autenticación
    const userId = getUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "No autorizado" })
    }

    // Buscar el usuario con rol RENTER
    const renter = await prisma.usuario.findFirst({
      where: {
        id: Number.parseInt(renterId),
        roles: {
          some: {
            rol: {
              rol: "RENTER",
            },
          },
        },
      },
      include: {
        // Incluir información básica
        ciudad: {
          select: {
            nombre: true,
          },
        },
        // Incluir calificaciones recibidas
        calificaciones: {
          where: {
            id_usuario: Number.parseInt(renterId),
          },
          orderBy: {
            fecha_creacion: "desc",
          },
          include: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                foto: true,
              },
            },
          },
        },
        // Incluir reservas completadas
        reservas: {
          where: {
            estado: "COMPLETADA",
          },
          select: {
            id: true,
            fecha_inicio: true,
            fecha_fin: true,
          },
        },
      },
    })

    if (!renter) {
      return res.status(404).json({ error: "Renter no encontrado" })
    }

    // Obtener calificaciones recibidas como renter
    const calificacionesReserva = await prisma.calificacionReserva.findMany({
      where: {
        reserva: {
          id_usuario: Number.parseInt(renterId)
        }
      },
      orderBy: {
        fecha_creacion: "desc"
      },
      include: {
        reserva: {
          include: {
            carro: {
              include: {
                usuario: true // El host que califica
              }
            }
          }
        }
      }
    });

    // Calcular calificación promedio
    let rating = 0
    if (renter.calificaciones && renter.calificaciones.length > 0) {
      const totalRating = renter.calificaciones.reduce((sum, cal) => sum + (cal.calf_usuario || 0), 0)
      rating = totalRating / renter.calificaciones.length
    }

    // Formatear respuesta
    const renterDetails = {
      id: renter.id,
      nombre: renter.nombre,
      correo: renter.correo,
      telefono: renter.telefono,
      foto: renter.foto,
      ciudad: renter.ciudad?.nombre,
      fechaRegistro: renter.fecha_creacion,
      rating: rating,
      totalViajes: renter.reservas.length,
      calificaciones: renter.calificaciones.map((cal) => ({
        id: cal.id,
        calificacion: cal.calf_usuario,
        comentario: cal.comentario,
        fecha: cal.fecha_creacion,
        calificador: {
          id: cal.usuario?.id,
          nombre: cal.usuario?.nombre,
          foto: cal.usuario?.foto,
        },
      })),
    }

    return res.json(renterDetails)
  } catch (error) {
    console.error("Error al obtener detalles del renter:", error)
    return res.status(500).json({ error: "Error al obtener detalles del renter" })
  }
})

module.exports = router
