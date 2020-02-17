object ManipulateDice {

  def add1(dices : Dices, dicesToMatch: Dices): Int = {
    val values = dices.matching(dicesToMatch)
    val backupResult = dices.results.toSeq
    for (id  <- 0 to dices.nbDices() - 1) {
      dices++(id)
      if (dices.matching(dicesToMatch).size > values.size) return id
      else {
        dices.set(backupResult.toArray)
      }
    }
    -1
  }

  def minus1(dices : Dices, dicesToMatch: Dices): Int = {
    val values = dices.matching(dicesToMatch)
    val backupResult = dices.results.toSeq
    for (id  <- 0 to dices.nbDices() - 1) {
      dices--(id)
      if (dices.matching(dicesToMatch).size > values.size) return id
      else {
        dices.set(backupResult.toArray)
      }
    }
    -1
  }

  def add1minus1(dices : Dices, dicesToMatch: Dices): (Int,Int) = {
    val add = add1(dices,dicesToMatch)
    val minus = minus1(dices,dicesToMatch)
    (add,minus)
  }

  def addOrminus1(dices : Dices, dicesToMatch: Dices): (Int,Int) = {
    val add = add1(dices,dicesToMatch)
    if (add == -1) (-1, minus1(dices,dicesToMatch))
    else (add,-1)
  }

  def set1(dices : Dices, dicesToMatch: Dices): Int = {
    val values = dices.matching(dicesToMatch)
    val backupResult = dices.results.toSeq
    for (id  <- 0 to dices.nbDices() - 1) {
      dices.set(id,dicesToMatch.get(id))
      if (dices.matching(dicesToMatch) != values) return id
      else {
        dices.set(backupResult.toArray)
      }
    }
    -1
  }

  def reverse1(dices : Dices, dicesToMatch: Dices): Int = {
    val values = dices.matching(dicesToMatch)
    val backupResult = dices.results.toSeq
    for (id  <- 0 to dices.nbDices() - 1) {
      dices.r(id)
      if (dices.matching(dicesToMatch).size > values.size) return id
      else {
        dices.set(backupResult.toArray)
      }
    }
    -1
  }

  def reroll1(dices : Dices, dicesToMatch: Dices): Int = {
    val values = dices.matching(dicesToMatch)
    val backupResult = dices.results.toSeq
    val rerolled = dices.rollOne()
    for (id  <- 0 to dices.nbDices() - 1) {
      dices.set(id,rerolled)
      if (dices.matching(dicesToMatch).size > values.size) return id
      else {
        dices.set(backupResult.toArray)
      }
    }
    -1
  }
}
