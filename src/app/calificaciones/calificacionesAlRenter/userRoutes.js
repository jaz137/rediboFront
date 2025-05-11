const express = require("express")
const { body } = require("express-validator")
const userController = require("../controllers/userController")
const { authenticateToken } = require("../middlewares/authMiddleware")

const router = express.Router()

// Validaciones para el registro de usuario
const registerValidations = [
  body("nombre")
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ min: 3 })
    .withMessage("El nombre debe tener al menos 3 caracteres"),
  body("correo").isEmail().withMessage("Correo electrónico inválido"),
  body("fechaNacimiento")
    .isISO8601()
    .withMessage("Fecha de nacimiento inválida")
    .custom((value) => {
      const birthDate = new Date(value)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const m = today.getMonth() - birthDate.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      if (age < 18) {
        throw new Error("Debes ser mayor de 18 años")
      }
      return true
    }),
  body("genero").isIn(["MASCULINO", "FEMENINO", "OTRO"]).withMessage("Género inválido"),
  body("ciudad").isInt().withMessage("ID de ciudad inválido"),
  body("contrasena")
    .optional()
    .if((value, { req }) => !req.body.foto)
    .notEmpty()
    .withMessage("La contraseña es obligatoria si no se usa Google Auth")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres")
    .matches(/[A-Z]/)
    .withMessage("La contraseña debe tener al menos una letra mayúscula")
    .matches(/[!@#$%^?&.*]/)
    .withMessage("La contraseña debe tener al menos un símbolo especial"),
  body("telefono").notEmpty().withMessage("El teléfono es obligatorio"),
  body("foto").optional().isURL().withMessage("URL de foto inválida"),
  body("rol").isIn(["HOST", "RENTER", "DRIVER"]).withMessage("Rol inválido"),
]

// Ruta para el registro de usuarios
router.post("/registro", registerValidations, userController.registerUser)

// Ruta para obtener el perfil del usuario
router.get("/perfil", authenticateToken, userController.getUserProfile)

// Ruta para agregar un nuevo rol de usuario
router.post("/add-rol", authenticateToken, userController.addUserRole)

module.exports = router
