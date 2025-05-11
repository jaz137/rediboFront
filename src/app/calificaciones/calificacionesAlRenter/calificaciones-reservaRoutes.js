const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const prisma = new PrismaClient();

// Validaciones
const calificacionValidations = [
  body('comportamiento').isInt({ min: 1, max: 5 }).withMessage('La calificación de comportamiento debe estar entre 1 y 5'),
  body('cuidado_vehiculo').isInt({ min: 1, max: 5 }).withMessage('La calificación de cuidado del vehículo debe estar entre 1 y 5'),
  body('puntualidad').isInt({ min: 1, max: 5 }).withMessage('La calificación de puntualidad debe estar entre 1 y 5'),
  body('comentario').optional().isString().trim().isLength({ max: 500 }).withMessage('El comentario no puede exceder los 500 caracteres'),
  body('id_reserva').isInt().withMessage('El ID de la reserva es requerido')
];

// Obtener calificaciones por host
router.get('/', authenticateToken, async (req, res) => {
  const { hostId, usuarioId } = req.query;

  try {
    if (hostId) {
      // Calificaciones por host
      const calificaciones = await prisma.calificacionReserva.findMany({
        where: {
          reserva: {
            carro: {
              usuario: {
                id: parseInt(hostId)
              }
            }
          }
        },
        include: {
          reserva: {
            include: {
              usuario: true,
              carro: {
                include: {
                  imagenes: true
                }
              }
            }
          }
        }
      });
      return res.json(calificaciones);
    } else if (usuarioId) {
      // Calificaciones por arrendatario
      const calificaciones = await prisma.calificacionReserva.findMany({
        where: {
          reserva: {
            id_usuario: parseInt(usuarioId)
          }
        },
        include: {
          reserva: {
            include: {
              carro: {
                include: {
                  usuario: true
                }
              },
              usuario: true
            }
          }
        },
        orderBy: {
          fecha_creacion: 'desc'
        }
      });
      return res.json(calificaciones);
    } else {
      return res.status(400).json({ error: 'Falta hostId o usuarioId en la consulta' });
    }
  } catch (error) {
    console.error('Error al obtener calificaciones:', error);
    return res.status(500).json({ error: 'Error al obtener calificaciones' });
  }
});

// Crear nueva calificación
router.post('/', authenticateToken, calificacionValidations, async (req, res) => {
  try {
    const { 
      comportamiento, 
      cuidado_vehiculo, 
      puntualidad, 
      comentario, 
      id_reserva 
    } = req.body;

    // Verificar si la reserva existe y pertenece al usuario
    const reserva = await prisma.reserva.findUnique({
      where: { id: parseInt(id_reserva) },
      include: { carro: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Verificar si el usuario es el dueño del carro
    if (reserva.carro.id_usuario_rol !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para calificar esta reserva' });
    }

    const nuevaCalificacion = await prisma.calificacionReserva.create({
      data: {
        comportamiento,
        cuidado_vehiculo,
        puntualidad,
        comentario,
        fecha_creacion: new Date(),
        reserva: {
          connect: {
            id: parseInt(id_reserva)
          }
        }
      },
      include: {
        reserva: {
          include: {
            usuario: true
          }
        }
      }
    });

    res.status(201).json(nuevaCalificacion);
  } catch (error) {
    console.error('Error al crear calificación:', error);
    res.status(500).json({ 
      error: 'Error al crear calificación',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Actualizar calificación existente
router.put('/:id', authenticateToken, [
  body('comportamiento').optional().isInt({ min: 1, max: 5 }),
  body('cuidado_vehiculo').optional().isInt({ min: 1, max: 5 }),
  body('puntualidad').optional().isInt({ min: 1, max: 5 }),
  body('comentario').optional().isString().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      comportamiento, 
      cuidado_vehiculo, 
      puntualidad, 
      comentario 
    } = req.body;

    // Verificar si la calificación existe y pertenece al usuario
    const calificacionExistente = await prisma.calificacionReserva.findUnique({
      where: { id: parseInt(id) },
      include: {
        reserva: {
          include: {
            carro: true
          }
        }
      }
    });

    if (!calificacionExistente) {
      return res.status(404).json({ error: 'Calificación no encontrada' });
    }

    if (calificacionExistente.reserva.carro.id_usuario_rol !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta calificación' });
    }

    const calificacionActualizada = await prisma.calificacionReserva.update({
      where: {
        id: parseInt(id)
      },
      data: {
        comportamiento,
        cuidado_vehiculo,
        puntualidad,
        comentario
      },
      include: {
        reserva: {
          include: {
            usuario: true
          }
        }
      }
    });

    res.json(calificacionActualizada);
  } catch (error) {
    console.error('Error al actualizar calificación:', error);
    res.status(500).json({ 
      error: 'Error al actualizar calificación',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Eliminar calificación
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la calificación existe y pertenece al usuario
    const calificacionExistente = await prisma.calificacionReserva.findUnique({
      where: { id: parseInt(id) },
      include: {
        reserva: {
          include: {
            carro: true
          }
        }
      }
    });

    if (!calificacionExistente) {
      return res.status(404).json({ error: 'Calificación no encontrada' });
    }

    console.log("ID usuario autenticado:", req.user.id);
    console.log("ID usuario dueño del carro:", calificacionExistente.reserva.carro.id_usuario_rol);
    console.log("ID de la calificación:", id);

    if (calificacionExistente.reserva.carro.id_usuario_rol !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta calificación' });
    }

    await prisma.calificacionReserva.delete({
      where: {
        id: parseInt(id)
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar calificación:', error);
    res.status(500).json({ 
      error: 'Error al eliminar calificación',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 