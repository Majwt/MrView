
export default function DetailsNote() {
  return (
      <p className="details-aggregation-note">
        Process/PID values are representative aggregated values (max PID per side), not guaranteed to be the latest sample.
        <br />
        The dynamic port is latest seen port for the connection, but may not be the only ports used in the connection history.
      </p>
  )

}
