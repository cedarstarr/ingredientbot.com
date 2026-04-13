'use client'

// F47: 12-week contribution heatmap — GitHub-style grid showing cooking activity
// Each cell = one day; darker green = more recipes cooked that day.

interface CookingHeatmapProps {
  heatmapCounts: Record<string, number> // day ISO string → count
  startDate: string                     // ISO string of the first day in the 84-day window
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function heatColor(count: number): string {
  if (count === 0) return 'bg-muted/60 dark:bg-muted/30'
  if (count === 1) return 'bg-green-200 dark:bg-green-900'
  if (count === 2) return 'bg-green-400 dark:bg-green-700'
  return 'bg-green-600 dark:bg-green-500' // 3+
}

export function CookingHeatmap({ heatmapCounts, startDate }: CookingHeatmapProps) {
  // Build the 84-day array starting from startDate
  const days: { date: string; count: number }[] = []
  const start = new Date(startDate)
  start.setUTCHours(0, 0, 0, 0)

  for (let i = 0; i < 84; i++) {
    const d = new Date(start.getTime() + i * 86_400_000)
    const dateStr = d.toISOString().split('T')[0]
    days.push({ date: dateStr, count: heatmapCounts[dateStr] ?? 0 })
  }

  // Arrange into 12 columns (weeks) × 7 rows (days of week)
  // Column 0 = oldest week, column 11 = most recent week
  const weeks: { date: string; count: number }[][] = []
  for (let w = 0; w < 12; w++) {
    weeks.push(days.slice(w * 7, w * 7 + 7))
  }

  const total = Object.values(heatmapCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Cooking Activity (last 12 weeks)</h2>
        <span className="text-xs text-muted-foreground">{total} cook{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid: rows = day-of-week (Sun–Sat), cols = weeks */}
      <div className="flex gap-1.5">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 mr-1">
          {DAY_LABELS.map(d => (
            <span key={d} className="h-3.5 flex items-center text-[9px] text-muted-foreground leading-none">{d}</span>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-1 overflow-x-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={day.count > 0 ? `${day.date}: ${day.count} recipe${day.count !== 1 ? 's' : ''} cooked` : day.date}
                  className={`h-3.5 w-3.5 rounded-sm transition-colors ${heatColor(day.count)}`}
                  aria-label={`${day.date}: ${day.count} recipes cooked`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {['bg-muted/60 dark:bg-muted/30', 'bg-green-200 dark:bg-green-900', 'bg-green-400 dark:bg-green-700', 'bg-green-600 dark:bg-green-500'].map((cls, i) => (
          <div key={i} className={`h-3 w-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  )
}
