import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js'

// Eén keer registreren voor de hele app; alle dashboard-grafieken gebruiken
// bar/line/doughnut (de omzetverloop-grafiek mixt bar + line voor de
// vorige-periode-stippellijn, dus beide controllers zijn nodig).
Chart.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement, Tooltip, Legend)
