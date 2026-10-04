        const { error: coffeeError } = await supabase
          .from("place_coffee_details")
          .update({
            coffee_kind: text("coffee_kind") || "regular",
            roaster: roasterName || null,
            sells_beans: bool("sells_beans"),
            has_roaster: hasRoaster,
            has_decaf: bool("has_decaf"),
            has_oat_milk: bool("has_oat_milk"),
            has_soy_milk: bool("has_soy_milk"),
            has_coconut_milk: bool("has_coconut_milk"),
            has_almond_milk: bool("has_almond_milk"),
            laptop_friendly: bool("laptop_friendly"),
            ambience,
            food,
          })
          .eq("place_id", placeId);