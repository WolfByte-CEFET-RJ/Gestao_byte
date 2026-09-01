import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'

type DataPoint = { name: string; y: number }

export default function PieChart({ data, title = '' }: { data: DataPoint[]; title?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return

    Highcharts.chart(ref.current, {
      chart: { type: 'pie', backgroundColor: 'transparent' },
      title: { text: title },
      tooltip: { pointFormat: '{series.name}: <b>{point.y}</b>' },
      accessibility: { point: { valueSuffix: '' } },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b>: {point.y}'
          }
        }
      },
      series: [
        {
          name: 'Cards',
          colorByPoint: true,
          type: 'pie',
          data
        }
      ]
    } as any)
  }, [data, title])

  return <div ref={ref} />
}
