const PerfumeHouseAddressBlock = ({ perfumeHouse }) => (
  <address className="flex flex-col md:flex-row items-start gap-2 p-4 bg-noir-dark text-noir-gold-100 ">
    <div className="md:w-1/2 w-full flex flex-col gap-2">
      {perfumeHouse.address && (
        <p className="text-sm">
          <span className="font-medium text-xl text-noir-gold">Address: </span>
          {perfumeHouse.address}
        </p>
      )}
      {perfumeHouse.country && (
        <p className="text-sm">
          <span className="font-medium text-xl text-noir-gold">Country: </span>{" "}
          {perfumeHouse.country}
        </p>
      )}
    </div>
    <div className="md:w-1/2 w-full flex flex-col gap-2">
      {perfumeHouse.email && (
        <p className="text-sm">
          <span className="font-medium text-xl text-noir-gold">Email: </span>
          {perfumeHouse.email}
        </p>
      )}
      {perfumeHouse.phone && (
        <p className="text-sm">
          <span className="font-medium text-xl text-noir-gold">Phone: </span>{" "}
          {perfumeHouse.phone}
        </p>
      )}
      {perfumeHouse.website && (
        <p className="text-sm">
          <span className="font-medium text-xl text-noir-gold">Website: </span>{" "}
          <a href={perfumeHouse.website} target="_blank" rel="noopener noreferrer">
            {perfumeHouse.website}
          </a>
        </p>
      )}
    </div>
  </address>
)

export default PerfumeHouseAddressBlock
