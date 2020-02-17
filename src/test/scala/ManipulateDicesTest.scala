import org.scalatest.FunSuite

class ManipulateDicesTest extends FunSuite {

  test("Manipulate one Die: +1") {
    val dices = new Dices(6)
    val dice0 : Int = dices.get(0)
    dices++(0)
    assert(dices.get(0) == dice0+1)
  }

  test("Manipulate several Dices: +1") {
    val dices = new Dices(6)
    val dicesToMatch = new Dices(6)
    dices.set(dicesToMatch.results)
    dices--(0)
    assert(ManipulateDice.add1(dices, dicesToMatch) == 0)
    dices--(5)
    println(s"$dices vs $dicesToMatch so ${dices.matching(dicesToMatch)}")
    assert(ManipulateDice.add1(dices, dicesToMatch) == 5)
  }

  test("Manipulate several Dices: -1") {
    val dices = new Dices(6)
    val dicesToMatch = new Dices(6)
    dices.set(dicesToMatch.results)
    dices++(0)
    assert(ManipulateDice.minus1(dices, dicesToMatch) == 0)
    dices++(5)
    assert(ManipulateDice.minus1(dices, dicesToMatch) == 5)
  }

  test("Manipulate several Dices: +-1") {
    val dices = new Dices(6)
    val dicesToMatch = new Dices(6)
    dices.set(dicesToMatch.results)
    dices--(0)
    dices++(5)
    assert(ManipulateDice.add1minus1(dices, dicesToMatch) == (0,5))
  }

  test("Manipulate several Dices: set") {
    val dices = new Dices(6)
    val dicesToMatch = new Dices(6)
    dices.set(dicesToMatch.results)
    dices--(0)
    dices++(5)
    assert(ManipulateDice.set1(dices, dicesToMatch) == (0))
    assert(ManipulateDice.set1(dices, dicesToMatch) == (5))
    assert(ManipulateDice.set1(dices, dicesToMatch) == -1)
    for (i <- 0 to 5) {
      dices--(i)
    }
    for (i <- 0 to 5) {
      assert(ManipulateDice.set1(dices, dicesToMatch) == (i))
    }
  }

  test("Manipulate several Dices: set with sorted") {
    val dices = new SortedDices(6)
    val dicesToMatch = new SortedDices(6)
    dices.set(dicesToMatch.results)
    dices--(0)
    dices++(5)
    assert(ManipulateDice.set1(dices, dicesToMatch) == (0))
    assert(ManipulateDice.set1(dices, dicesToMatch) == (5))
    assert(ManipulateDice.set1(dices, dicesToMatch) == -1)
    for (i <- 0 to 5) {
      dices.set(i,0)
    }
    for (i <- 0 to 5) {
      println(s"$dices compared to $dicesToMatch")
      assert(ManipulateDice.set1(dices, dicesToMatch) == i)
    }
  }

}
