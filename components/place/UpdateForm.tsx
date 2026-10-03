          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Wash
              </span>

              <input
                value={washAmount}
                onChange={(e) => setWashAmount(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Dryer
              </span>

              <input
                value={dryerAmount}
                onChange={(e) => setDryerAmount(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Total?
              </span>

              <input
                value={
                  Number(washAmount || 0) + Number(dryerAmount || 0) || ""
                }
                readOnly
                className={`${selectClass} bg-slate-50 text-slate-500`}
              />
            </label>
          </div>