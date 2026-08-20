import { useState } from 'react';

type TipCategory = 'economia' | 'cocina' | 'cajeros' | 'meseros';

interface Tip {
  title: string;
  content: string;
  icon: string;
}

const TIPS: Record<TipCategory, { label: string; icon: string; color: string; tips: Tip[] }> = {
  economia: {
    label: 'Economía',
    icon: '💰',
    color: 'emerald',
    tips: [
      {
        title: 'Controla el desperdicio de alimentos',
        content: 'Registra diariamente cuánta comida se tira. Un restaurante promedio desperdicia entre 4% y 10% de sus insumos. Reducir ese número a 2-3% puede representar miles de pesos al mes.',
        icon: '🗑️',
      },
      {
        title: 'Revisa tu ticket promedio semanal',
        content: 'Si tu ticket promedio baja, capacita a tus meseros en ventas sugeridas: "¿Le gustaría agregar una bebida?" puede aumentar el ticket 15-20%.',
        icon: '📊',
      },
      {
        title: 'Negocia con proveedores cada 3 meses',
        content: 'Pide cotizaciones a al menos 3 proveedores. La competencia entre ellos te da poder de negociación. Un 5% de descuento en insumos se traduce directamente en utilidad.',
        icon: '🤝',
      },
      {
        title: 'Calcula el costo real de cada platillo',
        content: 'El costo de insumos no debe superar el 30-35% del precio de venta. Si un platillo cuesta $40 de insumos, su precio mínimo debe ser $120.',
        icon: '🧮',
      },
      {
        title: 'Horarios muertos = oportunidad',
        content: 'Ofrece promociones en horarios de baja demanda (2-5 PM): "Happy Hour", "Combo vespertino". Es mejor vender barato que tener mesas vacías.',
        icon: '⏰',
      },
      {
        title: 'Separa tus cuentas personales del negocio',
        content: 'Ten una cuenta bancaria exclusiva para el restaurante. Págate un sueldo fijo. Mezclar finanzas personales con las del negocio es el error #1 de restaurantes que quiebran.',
        icon: '🏦',
      },
    ],
  },
  cocina: {
    label: 'Cocina',
    icon: '👨‍🍳',
    color: 'orange',
    tips: [
      {
        title: 'Mise en place: todo listo antes del servicio',
        content: 'Prepara todos los ingredientes cortados, salsas listas y estaciones organizadas ANTES de abrir. Un cocinero que corta durante el servicio es un cuello de botella.',
        icon: '🔪',
      },
      {
        title: 'FIFO: Primero en entrar, primero en salir',
        content: 'Etiqueta todo con fecha. Lo que llegó primero se usa primero. Esto reduce merma por caducidad y mantiene la frescura.',
        icon: '📦',
      },
      {
        title: 'Limpia mientras cocinas',
        content: 'No esperes al final del turno para limpiar. Lava, limpia y organiza entre cada plato. Cocina limpia = cocina rápida = menos errores.',
        icon: '🧽',
      },
      {
        title: 'Estandariza las porciones',
        content: 'Usa cucharas medidoras, tazas y básculas. Si cada cocinero pone una cantidad diferente de queso, tu costo de platillo será impredecible.',
        icon: '⚖️',
      },
      {
        title: 'Comunica los 86 inmediatamente',
        content: 'Cuando un ingrediente se acaba, avisa al mesero DE INMEDIATO. Es peor que un cliente ordene algo y luego le digan que no hay.',
        icon: '🚨',
      },
      {
        title: 'Revisa temperaturas diario',
        content: 'Refrigerador: 0-4°C. Congelador: -18°C o menos. Un refrigerador a 7°C ya es zona de peligro para proteínas. Revisa con termómetro, no "al tacto".',
        icon: '🌡️',
      },
    ],
  },
  cajeros: {
    label: 'Cajeros',
    icon: '💳',
    color: 'blue',
    tips: [
      {
        title: 'Cuenta el efectivo al iniciar y cerrar turno',
        content: 'Siempre haz un conteo con testigo al inicio. Al cerrar, cuenta frente al gerente. Documenta cualquier diferencia, por mínima que sea.',
        icon: '💵',
      },
      {
        title: 'Verifica billetes grandes',
        content: 'Usa marcador detector o lámpara UV para billetes de $500 y $1000. Un billete falso puede eliminar la ganancia de horas de trabajo.',
        icon: '🔍',
      },
      {
        title: 'Ofrece siempre el ticket al cliente',
        content: 'El ticket es la prueba de la transacción. Aunque el cliente diga que no lo quiere, pregunta siempre. Es tu protección ante reclamaciones.',
        icon: '🧾',
      },
      {
        title: 'No dejes la caja abierta',
        content: 'Cierra el cajón después de cada transacción. Cajón abierto = tentación + riesgo de robo hormiga. Es un hábito que se forma en la primera semana.',
        icon: '🔒',
      },
      {
        title: 'Memoriza los precios principales',
        content: 'Conocer los precios de los 10 productos más vendidos te hace más rápido y te permite detectar errores antes de cobrar.',
        icon: '🧠',
      },
      {
        title: 'Maneja los cambios con calma',
        content: 'Cuando un cliente se queja del precio o del cobro, mantén la calma. Muestra el ticket, explica el desglose. Si el error es tuyo, discúlpate y corrige sin drama.',
        icon: '😌',
      },
    ],
  },
  meseros: {
    label: 'Meseros',
    icon: '🍽️',
    color: 'purple',
    tips: [
      {
        title: 'Saluda en los primeros 30 segundos',
        content: 'Un cliente que espera más de 1 minuto sin ser reconocido ya está molesto. Aunque estés ocupado, un "Bienvenido, en un momento le atiendo" cambia todo.',
        icon: '👋',
      },
      {
        title: 'Sugiere, no preguntes "¿algo más?"',
        content: 'En vez de "¿algo más?", di "Le recomiendo nuestro postre de la casa" o "¿Le traigo una bebida para acompañar?". La sugerencia específica vende 3x más que la pregunta genérica.',
        icon: '💬',
      },
      {
        title: 'Anota TODO, no confíes en tu memoria',
        content: 'Incluso si crees que te lo puedes memorizar. Un error en una orden cuesta: el platillo desperdiciado + tiempo de cocina + cliente insatisfecho + propina perdida.',
        icon: '📝',
      },
      {
        title: 'Revisa la mesa antes de entregar la cuenta',
        content: 'Pregunta "¿Todo estuvo bien?" ANTES de llevar la cuenta. Es tu última oportunidad de arreglar algo. Después de pagar, el cliente no regresa — se va molesto.',
        icon: '✅',
      },
      {
        title: 'Conoce los alérgenos del menú',
        content: 'Saber qué platillos llevan mariscos, gluten, lácteos o nueces puede evitar una emergencia médica. Pregunta a cocina si no estás seguro.',
        icon: '⚠️',
      },
      {
        title: 'Limpia la mesa en menos de 2 minutos',
        content: 'Mesa sucia = mesa muerta = dinero perdido. En hora pico, cada minuto que una mesa está sucia es un cliente en la puerta que se va.',
        icon: '⚡',
      },
    ],
  },
};

const CATEGORIES: TipCategory[] = ['economia', 'cocina', 'cajeros', 'meseros'];

export default function Tips() {
  const [activeCategory, setActiveCategory] = useState<TipCategory>('economia');
  const categoryData = TIPS[activeCategory];

  return (
    <div>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold">💡 Consejos para tu Restaurante</h1>
        <p className="text-gray-500 text-xs md:text-sm mt-1">Tips prácticos para mejorar la operación día a día</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
        {CATEGORIES.map((cat) => {
          const data = TIPS[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span>{data.icon}</span>
              <span>{data.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tips grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-4">
        {categoryData.tips.map((tip, index) => (
          <div
            key={index}
            className="bg-gray-800 border border-gray-700 rounded-xl p-4 md:p-5 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{tip.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm md:text-base mb-2">{tip.title}</h3>
                <p className="text-gray-400 text-xs md:text-sm leading-relaxed">{tip.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-6 md:mt-8 bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
        <p className="text-gray-500 text-xs md:text-sm">
          💡 Estos consejos se actualizan periódicamente. ¿Tienes uno que quieras compartir? Habla con tu administrador.
        </p>
      </div>
    </div>
  );
}
