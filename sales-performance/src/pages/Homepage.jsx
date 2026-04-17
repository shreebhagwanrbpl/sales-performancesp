import { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function Home() {
  const [hero, setHero] = useState({});
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // 🔥 HERO DATA
    const unsubHero = onSnapshot(doc(db, "homepage", "hero"), (snap) => {
      if (snap.exists()) setHero(snap.data());
    });

    // 🔥 CLIENTS DATA
    const unsubClients = onSnapshot(doc(db, "homepage", "clients"), (snap) => {
      if (snap.exists()) setClients(snap.data().list || []);
    });

    // 🔥 PRODUCTS DATA
    const unsubProducts = onSnapshot(doc(db, "homepage", "products"), (snap) => {
      if (snap.exists()) setProducts(snap.data().list || []);
    });

    return () => {
      unsubHero();
      unsubClients();
      unsubProducts();
    };
  }, []);

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="hero section">
        <div className="container">
          <div className="row align-items-center">

            <div className="col-lg-6">
              <div className="hero-content">
                <h2>{hero.title}</h2>
                <p>{hero.desc}</p>

                <div className="hero-btns">
                  <a href="#contact" className="btn btn-primary">
                    Get a Free Consultation
                  </a>
                  <a href="#services" className="btn btn-outline">
                    Our Services
                  </a>
                </div>

                <div className="hero-stats">
                  {hero.stats?.map((item, i) => (
                    <div className="stat-item" key={i}>
                      <h3>{item.value}</h3>
                      <p>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <img
                src={hero.image || "/assets/img/p-4.jpg"}
                className="img-fluid"
              />
            </div>

          </div>
        </div>
      </section>

      {/* ================= CLIENTS ================= */}
      <section className="clients section">
        <div className="container">
          <div className="row">

            {clients.map((item, i) => (
              <div className="col-lg-2 col-6" key={i}>
                <img src={item.image} className="img-fluid" />
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* ================= PRODUCTS ================= */}
      <section className="alt-services section">
        <div className="container section-title">
          <h2>Our Products</h2>
        </div>

        <div className="container">
          <div className="row g-4">

            {products.map((item, i) => (
              <div className="col-lg-3" key={i}>
                <div className="service-card">

                  <div className="card-header">
                    <div className="icon-box">
                      <i className={item.icon || "bi bi-box"}></i>
                    </div>

                    <div className="feature-image">
                      <img
                        src={item.image}
                        className="img-fluid mb-4"
                      />
                    </div>

                    <h4>{item.title}</h4>
                  </div>

                  <div className="card-footer">
                    <a href="product.html" className="btn-explore">
                      Explore Products
                    </a>
                  </div>

                </div>
              </div>
            ))}

          </div>
        </div>
      </section>
    </>
  );
}